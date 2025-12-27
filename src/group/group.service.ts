import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { GroupEntity } from './entity/group.entity';
import {
  CreateGroupDto,
  UpdateGroupDto,
  GroupResponseDto,
  GroupWithMemberCountDto,
} from './dto/group.dto';
import { JwtPayload } from 'src/common/interface/jwt-payload.interface';
import { UserType } from 'src/common/enum/user-type.enum';
import { ERROR_MESSAGES } from 'src/common/constant/error-messages.constant';
import { GroupRepositoryService } from './services/group-repository.service';
import { autoMapListToDto, autoMapToDto } from 'src/common/utils/auto-map.util';

@Injectable()
export class GroupService {
  constructor(
    private readonly groupRepoService: GroupRepositoryService,
    private readonly entityManager: EntityManager,
  ) {}

  async checkById(id: string): Promise<GroupResponseDto> {
    const group = await this.groupRepoService.findOneById(id);
    if (!group) {
      throw new NotFoundException(
        ERROR_MESSAGES.NOT_FOUND_WITH_ID('Group', id),
      );
    }
    return autoMapToDto(GroupResponseDto, group);
  }

  /**
   * Tạo group mới
   */
  async create(
    dto: CreateGroupDto,
    user: JwtPayload,
  ): Promise<GroupResponseDto> {
    const group = new GroupEntity();
    group.name = dto.name;
    group.createdBy = user.userId;
    const savedGroup = await this.groupRepoService.save(group);

    return autoMapToDto(GroupResponseDto, savedGroup);
  }

  /**
   * Lấy tất cả groups
   */
  async findAll(): Promise<GroupResponseDto[]> {
    const groups = await this.groupRepoService.findAllGroups(true);
    return autoMapListToDto(GroupResponseDto, groups);
  }

  /**
   * Lấy groups với số lượng members
   */
  async findAllWithMemberCount(): Promise<GroupWithMemberCountDto[]> {
    const groups = await this.groupRepoService.findAllWithMemberCount();
    return autoMapListToDto(GroupWithMemberCountDto, groups);
  }

  /**
   * Cập nhật group
   */
  async update(
    id: string,
    dto: UpdateGroupDto,
    user: JwtPayload,
  ): Promise<GroupResponseDto> {
    const group = await this.groupRepoService.findOneById(id);

    // Kiểm tra quyền - chỉ admin hoặc người tạo
    if (group.createdBy !== user.userId && user.userType !== UserType.ADMIN) {
      throw new ForbiddenException(ERROR_MESSAGES.NO_PERMISSION_UPDATE_GROUP);
    }

    Object.assign(group, dto, { updatedBy: user.userId });

    const savedGroup = await this.groupRepoService.save(group);
    return autoMapToDto(GroupResponseDto, savedGroup);
  }

  /**
   * Xóa group
   */
  async remove(id: string, user: JwtPayload): Promise<void> {
    const group = await this.groupRepoService.findOneById(id);

    // Kiểm tra quyền - chỉ admin
    if (user.userType !== UserType.ADMIN) {
      throw new ForbiddenException(ERROR_MESSAGES.NO_PERMISSION_DELETE_GROUP);
    }

    await this.entityManager.remove(group);
  }

  /**
   * Tìm kiếm groups theo tên
   */
  async search(keyword: string): Promise<GroupResponseDto[]> {
    const groups = await this.groupRepoService.searchByName(keyword);
    return autoMapListToDto(GroupResponseDto, groups);
  }

  /**
   * Lấy mã group lớn nhất hiện tại
   */
  async getMaxCode(): Promise<number> {
    return this.groupRepoService.getMaxCode();
  }
}
