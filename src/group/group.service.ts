import { Injectable, ForbiddenException } from '@nestjs/common';
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

  /**
   * Chuyển đổi Entity sang DTO
   */
  private toResponseDto(group: GroupEntity): GroupResponseDto {
    return autoMapToDto(GroupResponseDto, group);
  }

  /**
   * Chuyển đổi danh sách Entity sang danh sách DTO
   */
  private toResponseDtos(groups: GroupEntity[]): GroupResponseDto[] {
    return groups.map((g) => this.toResponseDto(g));
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

    return this.toResponseDto(savedGroup);
  }

  /**
   * Lấy tất cả groups
   */
  async findAll(): Promise<GroupResponseDto[]> {
    const groups = await this.groupRepoService.findAllGroups(true);
    return this.toResponseDtos(groups);
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
    return this.toResponseDto(savedGroup);
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
    return this.toResponseDtos(groups);
  }

  /**
   * Lấy mã group lớn nhất hiện tại
   */
  async getMaxCode(): Promise<number> {
    return this.groupRepoService.getMaxCode();
  }
}
