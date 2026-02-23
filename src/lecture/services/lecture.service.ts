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

      // Tạo resources nếu có
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

      // Tạo context nếu có groupId
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
    const { courseId, classId, groupId, search, page = 1, size = 10 } = dto;

    const query = this.lectureRepository.createQueryBuilder('lecture');

    if (courseId || classId) {
      query
        .leftJoin('course', 'course', 'course.id = lecture.course_id')
        .leftJoin('class', 'class', 'class.id = course.class_id');
    }

    if (groupId) {
      query.leftJoin('lecture.contexts', 'context');
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
      ])
      .orderBy('lecture.orderColumn', 'ASC')
      .skip((page - 1) * size)
      .take(size)
      .distinct(true);

    // Phân quyền: user không phải admin chỉ xem được lecture được phân quyền
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

    if (groupId) {
      query.andWhere('context.groupId = :groupId', { groupId });
    }

    if (search) {
      query.andWhere('lecture.title ILIKE :search', {
        search: `%${search}%`,
      });
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

    // Phân quyền: user không phải admin chỉ xem được lecture được phân quyền
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

      // Kiểm tra code unique nếu có thay đổi
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

      // Cập nhật resources nếu có
      if (dto.resources !== undefined) {
        for (const resource of dto.resources) {
          // Tìm resource hiện tại với type và source tương ứng
          const existingResource = await manager.findOne(
            LectureResourceEntity,
            {
              where: {
                lecture: { id },
                type: resource.type as Type,
                source: resource.source as Source,
              },
            },
          );

          if (existingResource) {
            // Cập nhật URL nếu resource đã tồn tại
            existingResource.url = resource.url;
            existingResource.updatedBy = user.userId;
            await manager.save(existingResource);
          } else {
            // Tạo resource mới nếu chưa tồn tại
            const lectureResource = new LectureResourceEntity();
            lectureResource.lecture = updated;
            lectureResource.type = resource.type as Type;
            lectureResource.source = resource.source as Source;
            lectureResource.url = resource.url;
            lectureResource.createdBy = user.userId;
            await manager.save(lectureResource);
          }
        }
      }

      // Cập nhật hoặc tạo context nếu có thay đổi
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
          // Cập nhật context hiện tại
          if (dto.groupId !== undefined) existingContext.groupId = dto.groupId;
          existingContext.updatedBy = user.userId;
          await manager.save(existingContext);
        } else {
          // Tạo context mới nếu có thông tin phân bổ
          if (dto.groupId) {
            await manager.save(LectureGroupEntity, {
              lectureId: id,
              groupId: dto.groupId,
              createdBy: user.userId,
            });
          }
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

      // Xóa các file resources có source OFFLINE trước khi xóa lecture
      if (lecture.resources && lecture.resources.length > 0) {
        for (const resource of lecture.resources) {
          if (resource.source === Source.OFFLINE && resource.url) {
            await this.uploadService.deleteFileByPath(resource.url);
          }
        }
      }

      // Xóa avatar nếu có
      if (lecture.avatar) {
        await this.uploadService.deleteFileByPath(lecture.avatar);
      }

      // Xoá lecture sẽ tự động xoá lecture_context và lecture_resource nhờ onDelete: CASCADE
      await manager.delete(LectureEntity, { id });
    });
  }

  async getMaxCode(): Promise<number> {
    // Sử dụng Postgres regex để lấy phần số và trả về MAX nhanh hơn
    const result = await this.lectureRepository
      .createQueryBuilder('lecture')
      .select(
        "MAX(CASE WHEN regexp_replace(lecture.code, '\\D', '', 'g') = '' THEN 0 ELSE (regexp_replace(lecture.code, '\\D', '', 'g'))::int END)",
        'maxCode',
      )
      .getRawOne<{ maxCode: number | null }>();

    return result?.maxCode ?? 0;
  }
}
