import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { LectureEntity } from '../entity/lecture.entity';
import { LectureGroupEntity } from '../entity/lecture_group.entity';
import { LectureResourceEntity } from '../entity/lecture_resource.entity';
import {
  LectureResponse,
  LectureResponseDto,
} from '../dto/lecture.response.dto';
import type {
  CreateLectureDto,
  GetAllLectureDto,
  UpdateLectureDto,
} from '../dto/lecture.request.dto';
import { JwtPayload } from 'src/common/interface/jwt-payload.interface';
import { UserType } from 'src/common/enum/user-type.enum';
import { ERROR_MESSAGES } from 'src/common/constant/error-messages.constant';
import { Type, Source } from '../enum/lecture-resource.enum';
import { GroupService } from 'src/group/group.service';
import { runInTransaction } from 'src/common/database/transaction.utils';
import { PaginationResponseDto } from 'src/common/dto/pagination.dto';
import { autoMapListToDto } from 'src/common/utils/auto-map.util';
import { EMPTY_UUID } from 'src/common/constant/constant';
import { UploadService } from 'src/upload/upload.service';

@Injectable()
export class LectureService {
  constructor(
    @InjectRepository(LectureEntity)
    private readonly lectureRepository: Repository<LectureEntity>,
    private readonly entityManager: EntityManager,
    private readonly groupService: GroupService,
    private readonly uploadService: UploadService,
  ) {}

  async create(
    dto: CreateLectureDto,
    user: JwtPayload,
  ): Promise<LectureResponseDto> {
    return runInTransaction(this.entityManager, async (manager) => {
      const lecture = manager.create(LectureEntity, {
        code: dto.code,
        title: dto.title,
        note: dto.note,
        orderColumn: dto.orderColumn,
        avatar: dto.avatar,
        courseId: dto.courseId,
        createdBy: user.userId,
      });

      const saved = await manager.save(lecture);

      if (dto.resources && dto.resources.length > 0) {
        for (const resource of dto.resources) {
          const lectureResource = new LectureResourceEntity();
          lectureResource.lecture = saved;
          lectureResource.type = resource.type as Type;
          lectureResource.source = resource.source as Source;
          lectureResource.url = resource.url;
          lectureResource.createdBy = user.userId;
          await manager.save(lectureResource);
        }
      }

      if (dto.groupId) {
        await this.groupService.checkById(dto.groupId);

        await manager.save(LectureGroupEntity, {
          lectureId: saved.id,
          groupId: dto.groupId,
          createdBy: user.userId,
        });
      }

      return saved;
    });
  }

  async findAll(
    dto: GetAllLectureDto,
    user: JwtPayload,
  ): Promise<PaginationResponseDto<LectureResponse>> {
    const {
      courseId,
      classId,
      groupId,
      userId,
      isGetResource,
      search,
      page = 1,
      size = 10,
    } = dto;

    const query = this.lectureRepository.createQueryBuilder('lecture');

    if (courseId || classId) {
      query
        .leftJoin('course', 'course', 'course.id = lecture.course_id')
        .leftJoin('class', 'class', 'class.id = course.class_id');
    }

    if (groupId) {
      query.leftJoin('lecture.contexts', 'context');
    }

    if (userId) {
      query.leftJoin(
        'lecture_user',
        'lecture_user',
        'lecture_user.lecture_id = lecture.id',
      );
    }

    if (isGetResource) {
      query.leftJoin('lecture.resources', 'resource');
    }

    query
      .select([
        'lecture.id AS id',
        'lecture.code AS code',
        'lecture.title AS title',
        'lecture.note AS note',
        'lecture.orderColumn AS "orderColumn"',
        'lecture.avatar AS avatar',
        'lecture.courseId AS "courseId"',
        groupId ? 'context.groupId AS "groupId"' : 'NULL::text AS "groupId"',
        ...(isGetResource
          ? [
              'resource.id AS "resourceId"',
              'resource.type AS "resourceType"',
              'resource.source AS "resourceSource"',
              'resource.url AS "resourceUrl"',
            ]
          : []),
      ])
      .orderBy('lecture.orderColumn', 'ASC')
      .skip((page - 1) * size)
      .take(size)
      .distinct(true);

    if (user.userType !== UserType.ADMIN) {
      query.andWhere(
        `(
          lecture.id IN (
            SELECT lecture_id FROM lecture_user WHERE user_id = :userId
          )
          OR lecture.id IN (
            SELECT lg.lecture_id FROM lecture_group lg
            INNER JOIN user_group ug ON lg.group_id = ug.group_id
            WHERE ug.user_id = :userId
          )
        )`,
        { userId: user.userId },
      );
    }

    if (courseId) {
      query.andWhere('course.id = :courseId', { courseId });
    }

    if (classId) {
      query.andWhere('course.class_id = :classId', { classId });
    }

    if (userId) {
      query.andWhere('lecture_user.user_id = :userId', { userId });
    }

    if (groupId) {
      query.andWhere('context.groupId = :groupId', { groupId });
    }

    if (search) {
      query.andWhere('lecture.title ILIKE :search', {
        search: `%${search}%`,
      });
    }

    if (isGetResource) {
      type RawRow = {
        id: string;
        code?: string;
        title: string;
        note?: string;
        orderColumn: number;
        avatar?: string;
        courseId: string;
        groupId?: string | null;
        resourceId?: string | null;
        resourceType?: string;
        resourceSource?: string;
        resourceUrl?: string;
      };

      const raw = await query.getRawMany();
      const dataMap = (raw as RawRow[]).reduce<Record<string, any>>(
        (acc, row) => {
          if (!acc[row.id]) {
            acc[row.id] = {
              id: row.id,
              code: row.code,
              title: row.title,
              note: row.note,
              orderColumn: row.orderColumn,
              avatar: row.avatar,
              courseId: row.courseId,
              groupId: row.groupId ?? undefined,
              resources: [],
            };
          }

          if (row.resourceId) {
            acc[row.id].resources.push({
              id: row.resourceId,
              type: row.resourceType,
              source: row.resourceSource,
              url: row.resourceUrl,
            });
          }

          return acc;
        },
        {},
      );

      const data = Object.values(dataMap);

      return {
        page,
        size,
        total: data.length,
        data: autoMapListToDto(LectureResponseDto, data),
      };
    }

    const [raw, total] = await Promise.all([
      query.getRawMany(),
      query.getCount(),
    ]);

    return {
      page,
      size,
      total,
      data: autoMapListToDto(LectureResponseDto, raw),
    };
  }

  async findOne(id: string, user: JwtPayload): Promise<LectureResponseDto> {
    const lecture = await this.lectureRepository.findOne({
      where: { id },
      relations: ['resources'],
    });

    if (!lecture) {
      throw new NotFoundException(
        ERROR_MESSAGES.NOT_FOUND_WITH_ID('Lecture', id),
      );
    }

    if (user.userType !== UserType.ADMIN) {
      const hasAccess = await this.lectureRepository
        .createQueryBuilder('lecture')
        .where('lecture.id = :id', { id })
        .andWhere(
          `(
            lecture.id IN (
              SELECT lecture_id FROM lecture_user WHERE user_id = :userId
            )
            OR lecture.id IN (
              SELECT lg.lecture_id FROM lecture_group lg
              INNER JOIN user_group ug ON lg.group_id = ug.group_id
              WHERE ug.user_id = :userId
            )
          )`,
          { userId: user.userId },
        )
        .getCount();

      if (hasAccess === 0) {
        throw new NotFoundException(
          ERROR_MESSAGES.NOT_FOUND_WITH_ID('Lecture', id),
        );
      }
    }

    return lecture;
  }

  async update(
    id: string,
    dto: UpdateLectureDto,
    user: JwtPayload,
  ): Promise<LectureResponseDto> {
    return runInTransaction(this.entityManager, async (manager) => {
      const lecture = await manager.findOne(LectureEntity, {
        where: { id },
        relations: ['resources'],
      });

      if (!lecture) {
        throw new NotFoundException(
          ERROR_MESSAGES.NOT_FOUND_WITH_ID('Lecture', id),
        );
      }

      if (
        lecture.createdBy !== user.userId &&
        user.userType !== UserType.ADMIN
      ) {
        throw new ForbiddenException(
          'Bạn không có quyền chỉnh sửa bài giảng này',
        );
      }

      if (dto.code !== undefined && dto.code !== lecture.code) {
        const existingLecture = await manager.findOne(LectureEntity, {
          where: { code: dto.code },
        });
        if (existingLecture) {
          throw new ForbiddenException(`Mã bài giảng "${dto.code}" đã tồn tại`);
        }
        lecture.code = dto.code;
      }

      if (dto.title !== undefined) lecture.title = dto.title;
      if (dto.note !== undefined) lecture.note = dto.note;
      if (dto.orderColumn !== undefined) lecture.orderColumn = dto.orderColumn;
      if (dto.avatar !== undefined) lecture.avatar = dto.avatar;
      lecture.updatedBy = user.userId;

      const updated = await manager.save(lecture);

      if (dto.resources !== undefined) {
        await this.syncLectureResources(manager, lecture, updated, dto, user);
      }

      if (dto.groupId !== undefined) {
        if (dto.groupId) {
          await this.groupService.checkById(dto.groupId);
        }

        if (!dto.groupId && dto.userId) {
          dto.groupId = EMPTY_UUID;
        }

        const existingContext = await manager.findOne(LectureGroupEntity, {
          where: { lectureId: id },
        });

        if (existingContext) {
          if (dto.groupId !== undefined) existingContext.groupId = dto.groupId;
          existingContext.updatedBy = user.userId;
          await manager.save(existingContext);
        } else if (dto.groupId) {
          await manager.save(LectureGroupEntity, {
            lectureId: id,
            groupId: dto.groupId,
            createdBy: user.userId,
          });
        }
      }

      return updated;
    });
  }

  async remove(id: string, user: JwtPayload): Promise<void> {
    return await runInTransaction(this.entityManager, async (manager) => {
      const lecture = await manager.findOne(LectureEntity, {
        where: { id },
        relations: ['resources'],
      });

      if (!lecture) {
        throw new NotFoundException(
          ERROR_MESSAGES.NOT_FOUND_WITH_ID('Lecture', id),
        );
      }

      if (
        lecture.createdBy !== user.userId &&
        user.userType !== UserType.ADMIN
      ) {
        throw new ForbiddenException('Bạn không có quyền xoá bài giảng này');
      }

      if (lecture.resources && lecture.resources.length > 0) {
        for (const resource of lecture.resources) {
          if (resource.source === Source.OFFLINE && resource.url) {
            await this.uploadService.deleteFileByPath(resource.url);
          }
        }
      }

      if (lecture.avatar) {
        await this.uploadService.deleteFileByPath(lecture.avatar);
      }

      await manager.delete(LectureEntity, { id });
    });
  }

  async removeResources(
    id: string,
    user: JwtPayload,
  ): Promise<{ deletedCount: number }> {
    return runInTransaction(this.entityManager, async (manager) => {
      const lecture = await manager.findOne(LectureEntity, {
        where: { id },
        relations: ['resources'],
      });

      if (!lecture) {
        throw new NotFoundException(
          ERROR_MESSAGES.NOT_FOUND_WITH_ID('Lecture', id),
        );
      }

      if (
        lecture.createdBy !== user.userId &&
        user.userType !== UserType.ADMIN
      ) {
        throw new ForbiddenException(
          'Bạn không có quyền xoá tài nguyên của bài giảng này',
        );
      }

      for (const resource of lecture.resources ?? []) {
        if (resource.source === Source.OFFLINE && resource.url) {
          await this.uploadService.deleteFileByPath(resource.url);
        }
      }

      const result = await manager
        .createQueryBuilder()
        .delete()
        .from(LectureResourceEntity)
        .where('lecture_id = :id', { id })
        .execute();

      return {
        deletedCount: result.affected ?? 0,
      };
    });
  }

  async getMaxCode(): Promise<number> {
    const result = await this.lectureRepository
      .createQueryBuilder('lecture')
      .select(
        "MAX(CASE WHEN regexp_replace(lecture.code, '\\D', '', 'g') = '' THEN 0 ELSE (regexp_replace(lecture.code, '\\D', '', 'g'))::int END)",
        'maxCode',
      )
      .getRawOne<{ maxCode: number | null }>();

    return result?.maxCode ?? 0;
  }

  private async syncLectureResources(
    manager: EntityManager,
    lecture: LectureEntity,
    updatedLecture: LectureEntity,
    dto: UpdateLectureDto,
    user: JwtPayload,
  ): Promise<void> {
    const currentResources = lecture.resources ?? [];
    const targetResources = new Map<
      string,
      {
        type: Type;
        source: Source;
        url: string;
      }
    >();
    const syncedKeys = new Set<string>();

    for (const resource of dto.resources ?? []) {
      const type = resource.type as Type;
      const source = resource.source as Source;

      targetResources.set(this.getResourceKey(type, source), {
        type,
        source,
        url: resource.url,
      });
    }

    for (const existingResource of currentResources) {
      const resourceKey = this.getResourceKey(
        existingResource.type,
        existingResource.source,
      );
      const targetResource = targetResources.get(resourceKey);

      if (!targetResource) {
        await this.deleteOfflineLectureResourceFile(existingResource);
        await manager.remove(existingResource);
        continue;
      }

      if (syncedKeys.has(resourceKey)) {
        await this.deleteOfflineLectureResourceFile(
          existingResource,
          targetResource.url,
        );
        await manager.remove(existingResource);
        continue;
      }

      if (existingResource.url !== targetResource.url) {
        await this.deleteOfflineLectureResourceFile(
          existingResource,
          targetResource.url,
        );
        existingResource.url = targetResource.url;
        existingResource.updatedBy = user.userId;
        await manager.save(existingResource);
      }

      syncedKeys.add(resourceKey);
    }

    for (const [resourceKey, resource] of targetResources.entries()) {
      if (syncedKeys.has(resourceKey)) {
        continue;
      }

      const lectureResource = new LectureResourceEntity();
      lectureResource.lecture = updatedLecture;
      lectureResource.type = resource.type;
      lectureResource.source = resource.source;
      lectureResource.url = resource.url;
      lectureResource.createdBy = user.userId;
      await manager.save(lectureResource);
    }
  }

  private getResourceKey(type: Type, source: Source): string {
    return `${type}:${source}`;
  }

  private async deleteOfflineLectureResourceFile(
    resource: LectureResourceEntity,
    nextUrl?: string,
  ): Promise<void> {
    if (
      resource.source !== Source.OFFLINE ||
      !resource.url ||
      resource.url === nextUrl
    ) {
      return;
    }

    await this.uploadService.deleteFileByPath(resource.url);
  }
}
