import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { UserRepositoryService } from '../user/user-repository.service';
import { GroupRepositoryService } from '../group/services/group-repository.service';
import { UserGroupItemDto, CheckMembershipDto } from './dto/user-group.dto';
import { GroupMemberRole } from './enum/group-member-role.enum';
import { GroupEntity } from '../group/entity/group.entity';
import { UserGroupEntity } from './entity/user-group.entity';
import { UserEntity } from 'src/user/user.entity';
import {
  AddUsersToGroupDto,
  GroupMemberDto,
  GroupResponseDto,
} from '../group/dto/group.dto';
import { JwtPayload } from 'src/common/interface/jwt-payload.interface';
import { UserType } from 'src/common/enum/user-type.enum';
import { ERROR_MESSAGES } from 'src/common/constant/error-messages.constant';
import { autoMapListToDto } from 'src/common/utils/auto-map.util';
import { runInTransaction } from 'src/common/database/transaction.utils';

/**
 * Service xử lý logic nghiệp vụ cho UserGroup
 */
@Injectable()
export class UserGroupService {
  constructor(
    @InjectRepository(UserGroupEntity)
    private readonly userGroupRepoService: Repository<UserGroupEntity>,
    private readonly userRepoService: UserRepositoryService,
    private readonly groupRepoService: GroupRepositoryService,
    private readonly entityManager: EntityManager,
  ) {}

  /**
   * Lấy tất cả groups của một user với chi tiết
   */
  async getUserGroupsDetail(userId: string): Promise<UserGroupItemDto[]> {
    await this.userRepoService.validateUser(userId);

    const query = `
      SELECT 
        g.id,
        g.code,
        g.name,
        ug.role
      FROM user_group ug
      INNER JOIN "group" g ON ug.group_id = g.id
      WHERE ug.user_id = $1
      ORDER BY g.name ASC
    `;

    return autoMapListToDto(
      UserGroupItemDto,
      await this.userGroupRepoService.query(query, [userId]),
    );
  }

  /**
   * Lấy tất cả members của một group với chi tiết
   */
  async getGroupMembersDetail(groupId: string): Promise<GroupMemberDto[]> {
    await this.groupRepoService.findOneById(groupId);

    const query = `
      SELECT 
        u.id,
        u.user_name as "userName",
        u.full_name as "fullName",
        u.email,
        ug.role
      FROM user_group ug
      INNER JOIN "user" u ON ug.user_id = u.id
      WHERE ug.group_id = $1
      ORDER BY u.user_name ASC
    `;

    return autoMapListToDto(
      GroupMemberDto,
      await this.userGroupRepoService.query(query, [groupId]),
    );
  }

  /**
   * Kiểm tra user có trong group không
   */
  async checkMembership(
    userId: string,
    groupId: string,
  ): Promise<CheckMembershipDto> {
    const userGroup = await this.userGroupRepoService.findOne({
      where: { userId, groupId },
      select: ['role'],
    });

    return {
      isMember: !!userGroup,
      role: userGroup?.role,
    };
  }

  /**
   * Lấy role của user trong group
   */
  async getUserRole(
    userId: string,
    groupId: string,
  ): Promise<GroupMemberRole | null> {
    const userGroup = await this.userGroupRepoService.findOne({
      where: { userId, groupId },
      select: ['role'],
    });

    return userGroup?.role ?? null;
  }

  private async checkGroupExists(groupId: string): Promise<void> {
    const groupExists = await this.groupRepoService.findById(groupId);
    if (!groupExists) {
      throw new NotFoundException(
        ERROR_MESSAGES.NOT_FOUND_WITH_ID('Group', groupId),
      );
    }
  }

  /**
   * Thêm users vào group với role
   */
  async addUsersToGroup(
    groupId: string,
    dto: AddUsersToGroupDto,
    currentUser: JwtPayload,
  ): Promise<void> {
    return runInTransaction(this.entityManager, async (manager) => {
      await this.checkGroupExists(groupId);

      dto.users = dto.users.map((u) =>
        typeof u === 'string' ? { userId: u, role: GroupMemberRole.MEMBER } : u,
      );

      const records = dto.users.map((user) =>
        manager.create(UserGroupEntity, {
          groupId,
          role: user.role,
          userId: user.userId,
          createdBy: currentUser.userId,
        }),
      );

      await manager.save(UserGroupEntity, records);
    });
  }

  /**   * Thêm user vào nhiều group (dùng trong tạo user hoặc cập nhật user)
   */
  public async addUserToGroups(
    groupIds: string[],
    userId: string,
    createdBy: string,
    queryRunner: EntityManager,
  ): Promise<void> {
    await this.groupRepoService.validateGroupsExist(groupIds, queryRunner);

    const userGroupRepo = queryRunner.getRepository(UserGroupEntity);

    await userGroupRepo.save(
      groupIds.map((groupId) =>
        userGroupRepo.create({
          groupId,
          userId,
          role: GroupMemberRole.MEMBER,
          createdBy,
        }),
      ),
    );
  }

  /**   * Cập nhật groups của user (dùng trong cập nhật user)
   */
  public async updateUserGroups(
    groupIds: string[],
    userId: string,
    updatedBy: string,
    manager: EntityManager,
  ): Promise<void> {
    // 1. Validate groups tồn tại (read-only, không lock)
    await this.groupRepoService.validateGroupsExist(groupIds, manager);

    const userGroupRepo = manager.getRepository(UserGroupEntity);

    // 2. Lấy group hiện tại của user
    const existingRelations = await userGroupRepo.find({
      where: { userId },
      select: ['groupId'],
    });

    const existingGroupIds = existingRelations.map((r) => r.groupId);

    // 3. Tính diff
    const toAdd = groupIds.filter((id) => !existingGroupIds.includes(id));

    const toRemove = existingGroupIds.filter((id) => !groupIds.includes(id));

    // 4. Remove group cũ
    if (toRemove.length > 0) {
      await userGroupRepo.delete({
        userId,
        groupId: In(toRemove),
      });
    }

    // 5. Add group mới
    if (toAdd.length > 0) {
      await userGroupRepo.save(
        toAdd.map((groupId) =>
          userGroupRepo.create({
            userId,
            groupId,
            role: GroupMemberRole.MEMBER,
            createdBy: updatedBy,
          }),
        ),
      );
    }
  }

  /**
   * Xóa users khỏi group
   * Sử dụng transaction để đảm bảo tính nhất quán
   */
  async removeUsersFromGroup(
    groupId: string,
    userIds: string[],
    currentUser: JwtPayload,
  ): Promise<void> {
    // Sử dụng transaction
    await this.entityManager.connection.transaction(async (manager) => {
      const groupEntity = await manager.findOne(GroupEntity, {
        where: { id: groupId },
        relations: ['members', 'members.user'],
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

      // Xóa user_group records
      const userIdsToRemove = new Set(userIds);
      const userGroupsToRemove = groupEntity.members?.filter((ug) =>
        userIdsToRemove.has((ug as any).userId),
      );

      if (userGroupsToRemove && userGroupsToRemove.length > 0) {
        await manager.remove(userGroupsToRemove);
      }
    });
  }

  /**
   * Cập nhật role của user trong group
   */
  async updateMemberRole(
    groupId: string,
    userId: string,
    newRole: GroupMemberRole,
    currentUser: JwtPayload,
  ): Promise<void> {
    return runInTransaction(this.entityManager, async (manager) => {
      // Bước 1: ADMIN được phép luôn
      const isAdmin = currentUser.userType === UserType.ADMIN;

      if (!isAdmin) {
        const currentMember = await manager.findOne(UserGroupEntity, {
          where: {
            groupId,
            userId: currentUser.userId,
          },
        });

        if (!currentMember || currentMember.role !== GroupMemberRole.LEADER) {
          throw new ForbiddenException(
            'Chỉ leader hoặc admin mới có thể thay đổi role',
          );
        }
      }

      // Bước 2 + 3: update role (đồng thời check user có trong group)
      const result = await manager.update(
        UserGroupEntity,
        { groupId, userId },
        {
          role: newRole,
          updatedBy: currentUser.userId,
        },
      );

      if (result.affected === 0) {
        throw new NotFoundException('User không có trong group này');
      }
    });
  }

  /**
   * Lấy danh sách users trong group
   */
  async getGroupMembers(groupId: string): Promise<GroupMemberDto[]> {
    const query = `
      SELECT 
        u.id,
        u.user_name as "userName",
        u.full_name as "fullName",
        u.email,
        ug.role
      FROM user_group ug
      INNER JOIN "user" u ON ug.user_id = u.id
      WHERE ug.group_id = $1
      ORDER BY u.user_name ASC
    `;

    return autoMapListToDto(
      GroupMemberDto,
      await this.userGroupRepoService.query(query, [groupId]),
    );
  }

  /**
   * Lấy danh sách groups của current user (bao gồm role)
   */
  async getMyGroups(user: JwtPayload): Promise<GroupResponseDto[]> {
    const userGroups = await this.entityManager.find(UserGroupEntity, {
      where: { userId: user.userId },
      relations: ['group', 'group.members'],
    });

    if (userGroups.length === 0) {
      const userEntity = await this.entityManager.findOne(UserEntity, {
        where: { id: user.userId },
      });

      if (!userEntity) {
        throw new NotFoundException(
          ERROR_MESSAGES.NOT_FOUND_WITH_ID('User', user.userId),
        );
      }
      return [];
    }

    return autoMapListToDto(GroupResponseDto, userGroups);
  }
}
