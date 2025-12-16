import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { GroupEntity } from './group.entity';
import { UserEntity } from 'src/user/user.entity';
import {
  CreateGroupDto,
  UpdateGroupDto,
  GroupResponseDto,
  GroupWithMemberCountDto,
  GroupWithMembersDto,
  GroupMemberDto,
} from './dto/group.dto';
import { JwtPayload } from 'src/common/interface/jwt-payload.interface';
import { UserType } from 'src/common/enum/user-type.enum';
import { ERROR_MESSAGES } from 'src/common/constant/error-messages.constant';

@Injectable()
export class GroupService {
  constructor(
    @InjectRepository(GroupEntity)
    private readonly groupRepo: Repository<GroupEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  /**
   * Chuyển đổi Entity sang DTO
   */
  private toResponseDto(group: GroupEntity): GroupResponseDto {
    return {
      id: group.id,
      code: group.code,
      name: group.name,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
    };
  }

  /**
   * Chuyển đổi Entity sang DTO với số lượng members
   */
  private toWithMemberCountDto(group: GroupEntity): GroupWithMemberCountDto {
    return {
      ...this.toResponseDto(group),
      memberCount: group.users?.length || 0,
    };
  }

  /**
   * Chuyển đổi User sang MemberDto
   */
  private toMemberDto(user: UserEntity): GroupMemberDto {
    return {
      id: user.id,
      userName: user.userName,
      fullName: user.fullName,
      email: user.email,
    };
  }

  /**
   * Chuyển đổi Entity sang DTO với danh sách members
   */
  private toWithMembersDto(group: GroupEntity): GroupWithMembersDto {
    return {
      ...this.toResponseDto(group),
      members: group.users?.map((u) => this.toMemberDto(u)) || [],
    };
  }

  /**
   * Tạo group mới
   */
  async create(
    dto: CreateGroupDto,
    user: JwtPayload,
  ): Promise<GroupResponseDto> {
    const group = this.groupRepo.create({
      name: dto.name,
      createdBy: user.userId,
    });

    const savedGroup = await this.groupRepo.save(group);

    // Nếu có userIds, thêm users vào group
    if (dto.userIds && dto.userIds.length > 0) {
      const result = await this.addUsersToGroupInternal(
        savedGroup.id,
        dto.userIds,
        user,
      );
      return this.toResponseDto(result);
    }

    return this.toResponseDto(savedGroup);
  }

  /**
   * Lấy tất cả groups
   */
  async findAll(): Promise<GroupResponseDto[]> {
    const groups = await this.groupRepo.find({
      relations: ['users'],
      order: { createdAt: 'DESC' },
    });

    return groups.map((g) => this.toResponseDto(g));
  }

  /**
   * Lấy groups với số lượng members
   */
  async findAllWithMemberCount(): Promise<GroupWithMemberCountDto[]> {
    const groups = await this.groupRepo.find({
      relations: ['users'],
      order: { createdAt: 'DESC' },
    });

    return groups.map((g) => this.toWithMemberCountDto(g));
  }

  /**
   * Lấy chi tiết group theo ID
   */
  async findOne(id: string): Promise<GroupWithMembersDto> {
    const group = await this.findOneEntity(id);
    return this.toWithMembersDto(group);
  }

  /**
   * Lấy Entity group theo ID (internal use)
   */
  private async findOneEntity(id: string): Promise<GroupEntity> {
    const group = await this.groupRepo.findOne({
      where: { id },
      relations: ['users'],
    });

    if (!group) {
      throw new NotFoundException(
        ERROR_MESSAGES.NOT_FOUND_WITH_ID('Group', id),
      );
    }

    return group;
  }

  /**
   * Cập nhật group
   */
  async update(
    id: string,
    dto: UpdateGroupDto,
    user: JwtPayload,
  ): Promise<GroupResponseDto> {
    const group = await this.findOneEntity(id);

    // Kiểm tra quyền - chỉ admin hoặc người tạo
    if (group.createdBy !== user.userId && user.userType !== UserType.ADMIN) {
      throw new ForbiddenException(ERROR_MESSAGES.NO_PERMISSION_UPDATE_GROUP);
    }

    Object.assign(group, dto, { updatedBy: user.userId });

    const savedGroup = await this.groupRepo.save(group);
    return this.toResponseDto(savedGroup);
  }

  /**
   * Xóa group
   */
  async remove(id: string, user: JwtPayload): Promise<void> {
    const group = await this.findOneEntity(id);

    // Kiểm tra quyền - chỉ admin
    if (user.userType !== UserType.ADMIN) {
      throw new ForbiddenException(ERROR_MESSAGES.NO_PERMISSION_DELETE_GROUP);
    }

    await this.groupRepo.remove(group);
  }

  /**
   * Thêm users vào group (internal - trả về Entity)
   * Sử dụng transaction để đảm bảo tính nhất quán
   */
  private async addUsersToGroupInternal(
    groupId: string,
    userIds: string[],
    currentUser: JwtPayload,
  ): Promise<GroupEntity> {
    // Sử dụng transaction
    return this.groupRepo.manager.connection.transaction(async (manager) => {
      const group = await manager.findOne(GroupEntity, {
        where: { id: groupId },
        relations: ['users'],
      });

      if (!group) {
        throw new NotFoundException(
          ERROR_MESSAGES.NOT_FOUND_WITH_ID('Group', groupId),
        );
      }

      // Kiểm tra quyền
      if (
        group.createdBy !== currentUser.userId &&
        currentUser.userType !== UserType.ADMIN
      ) {
        throw new ForbiddenException(ERROR_MESSAGES.NO_PERMISSION_ADD_MEMBER);
      }

      // Lấy danh sách users
      const users = await manager.find(UserEntity, {
        where: { id: In(userIds) },
      });

      if (users.length !== userIds.length) {
        throw new BadRequestException(ERROR_MESSAGES.SOME_USERS_NOT_FOUND);
      }

      // Thêm users vào group (tránh trùng lặp)
      const existingUserIds = new Set(group.users?.map((u) => u.id) || []);
      const newUsers = users.filter((u) => !existingUserIds.has(u.id));

      group.users = [...(group.users || []), ...newUsers];
      group.updatedBy = currentUser.userId;

      return manager.save(group);
    });
  }

  /**
   * Thêm users vào group
   */
  async addUsersToGroup(
    groupId: string,
    userIds: string[],
    currentUser: JwtPayload,
  ): Promise<GroupWithMembersDto> {
    const group = await this.addUsersToGroupInternal(
      groupId,
      userIds,
      currentUser,
    );
    return this.toWithMembersDto(group);
  }

  /**
   * Xóa users khỏi group
   * Sử dụng transaction để đảm bảo tính nhất quán
   */
  async removeUsersFromGroup(
    groupId: string,
    userIds: string[],
    currentUser: JwtPayload,
  ): Promise<GroupWithMembersDto> {
    // Sử dụng transaction
    const group = await this.groupRepo.manager.connection.transaction(
      async (manager) => {
        const groupEntity = await manager.findOne(GroupEntity, {
          where: { id: groupId },
          relations: ['users'],
        });

        if (!groupEntity) {
          throw new NotFoundException(
            ERROR_MESSAGES.NOT_FOUND_WITH_ID('Group', groupId),
          );
        }

        // Kiểm tra quyền
        if (
          groupEntity.createdBy !== currentUser.userId &&
          currentUser.userType !== UserType.ADMIN
        ) {
          throw new ForbiddenException(
            ERROR_MESSAGES.NO_PERMISSION_REMOVE_MEMBER,
          );
        }

        // Lọc bỏ users cần xóa
        const userIdsToRemove = new Set(userIds);
        groupEntity.users =
          groupEntity.users?.filter((u) => !userIdsToRemove.has(u.id)) || [];
        groupEntity.updatedBy = currentUser.userId;

        return manager.save(groupEntity);
      },
    );

    return this.toWithMembersDto(group);
  }

  /**
   * Lấy danh sách users trong group
   */
  async getGroupMembers(groupId: string): Promise<GroupMemberDto[]> {
    const group = await this.findOneEntity(groupId);
    return group.users?.map((u) => this.toMemberDto(u)) || [];
  }

  /**
   * Lấy danh sách groups của một user
   */
  async getUserGroups(userId: string): Promise<GroupResponseDto[]> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['groups'],
    });

    if (!user) {
      throw new NotFoundException(
        ERROR_MESSAGES.NOT_FOUND_WITH_ID('User', userId),
      );
    }

    const groups = (user.groups as GroupEntity[]) || [];
    return groups.map((g) => this.toResponseDto(g));
  }

  /**
   * Lấy danh sách groups của current user
   */
  async getMyGroups(user: JwtPayload): Promise<GroupResponseDto[]> {
    return this.getUserGroups(user.userId);
  }

  /**
   * Kiểm tra user có trong group không
   */
  async isUserInGroup(userId: string, groupId: string): Promise<boolean> {
    const group = await this.groupRepo.findOne({
      where: { id: groupId },
      relations: ['users'],
    });

    if (!group) {
      return false;
    }

    return group.users?.some((u) => u.id === userId) || false;
  }

  /**
   * Tìm kiếm groups theo tên
   */
  async search(keyword: string): Promise<GroupResponseDto[]> {
    const groups = await this.groupRepo
      .createQueryBuilder('group')
      .leftJoinAndSelect('group.users', 'user')
      .where('LOWER(group.name) LIKE LOWER(:keyword)', {
        keyword: `%${keyword}%`,
      })
      .orderBy('group.name', 'ASC')
      .getMany();

    return groups.map((g) => this.toResponseDto(g));
  }

  /**
   * Lấy mã group lớn nhất hiện tại
   */
  async getMaxCode(): Promise<number> {
    const result = await this.groupRepo
      .createQueryBuilder('group')
      .select('MAX(group.code)', 'maxCode')
      .getRawOne<{ maxCode: number | null }>();

    return result?.maxCode ?? 0;
  }
}
