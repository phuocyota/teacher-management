import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GroupEntity } from '../entity/group.entity';
import { ERROR_MESSAGES } from 'src/common/constant/error-messages.constant';
import { BaseService } from 'src/common/sql/base.service';
import { GroupWithCountDto } from '../dto/group.dto';
import { autoMapListToDto, autoMapToDto } from 'src/common/utils/auto-map.util';

/**
 * Service xử lý các thao tác với GroupRepository
 */
@Injectable()
export class GroupRepositoryService extends BaseService<GroupEntity> {
  constructor(
    @InjectRepository(GroupEntity)
    protected readonly groupRepository: Repository<GroupEntity>,
  ) {
    super(groupRepository);
  }

  /**
   * Override getEntityName để custom error message
   */
  protected getEntityName(): string {
    return 'Group';
  }

  /**
   * Lưu group
   */
  async save(group: GroupEntity): Promise<GroupEntity> {
    return this.groupRepository.save(group);
  }

  /**
   * Lấy tất cả groups với relations
   */
  async findAllGroups(includeMembers = true): Promise<GroupEntity[]> {
    return this.groupRepository.find({
      relations: includeMembers ? ['members', 'members.user'] : ['members'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Lấy group theo ID với relations
   */
  async findOneById(id: string): Promise<GroupEntity> {
    const group = await this.groupRepository.findOne({
      where: { id },
      relations: ['members', 'members.user'],
    });

    if (!group) {
      throw new NotFoundException(
        ERROR_MESSAGES.NOT_FOUND_WITH_ID('Group', id),
      );
    }

    return group;
  }

  /**
   * Lấy tất cả groups với số lượng members (dùng raw SQL)
   */
  async findAllWithMemberCount(): Promise<GroupWithCountDto[]> {
    const query = `
      SELECT
        g.id,
        g.code,
        g.name,
        g.created_at as "createdAt",
        g.updated_at as "updatedAt",
        COUNT(ug.user_id) as "count"
      FROM "group" g
      LEFT JOIN user_group ug ON g.id = ug.group_id
      GROUP BY g.id
      ORDER BY g.created_at DESC
    `;
    return autoMapListToDto(
      GroupWithCountDto,
      await this.groupRepository.query(query),
    );
  }

  /**
   * Lấy group theo ID với số lượng members (dùng raw SQL)
   */
  async findOneWithMemberCount(id: string): Promise<GroupWithCountDto> {
    const query = `
      SELECT
        g.id,
        g.code,
        g.name,
        g.created_at as "createdAt",
        g.updated_at as "updatedAt",
        COUNT(ug.user_id) as "count"
      FROM "group" g
      LEFT JOIN user_group ug ON g.id = ug.group_id
      WHERE g.id = $1
      GROUP BY g.id
    `;
    return autoMapToDto(
      GroupWithCountDto,
      await this.groupRepository.query(query, [id]),
    );
  }

  /**
   * Tìm kiếm groups theo tên
   */
  async searchByName(keyword: string): Promise<GroupEntity[]> {
    const query = `
      SELECT DISTINCT g.*
      FROM "group" g
      LEFT JOIN user_group ug ON g.id = ug.group_id
      LEFT JOIN "user" u ON ug.user_id = u.id
      WHERE LOWER(g.name) LIKE LOWER($1)
      ORDER BY g.name ASC
    `;
    return autoMapListToDto(
      GroupEntity,
      await this.groupRepository.query(query, [`%${keyword}%`]),
    );
  }

  /**
   * Lấy mã group lớn nhất hiện tại
   */
  async getMaxCode(): Promise<number> {
    const result = await this.groupRepository
      .createQueryBuilder('group')
      .select('MAX(group.code)', 'maxCode')
      .getRawOne<{ maxCode: number | null }>();

    return result?.maxCode ?? 0;
  }

  /**
   * Get repository để sử dụng transaction
   */
  getRepository(): Repository<GroupEntity> {
    return this.groupRepository;
  }
}
