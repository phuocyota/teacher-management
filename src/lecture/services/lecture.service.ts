import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { LectureEntity } from '../entity/lecture.entity';
import { LectureContextEntity } from '../entity/lecture_context.entity';
import { LectureResourceEntity } from '../entity/lecture_resource.entity';
import { LectureResponseDto } from '../dto/lecture.dto';
import type { CreateLectureDto, UpdateLectureDto } from '../dto/lecture.dto';
import { JwtPayload } from 'src/common/interface/jwt-payload.interface';
import { UserType } from 'src/common/enum/user-type.enum';
import { ERROR_MESSAGES } from 'src/common/constant/error-messages.constant';
import { Type, Source } from '../enum/lecture-resource.enum';
import { ClassService } from 'src/class/class.service';
import { CourseService } from 'src/course/course.service';
import { GroupService } from 'src/group/group.service';
import { runInTransaction } from 'src/common/database/transaction.utils';

@Injectable()
export class LectureService {
  constructor(
    @InjectRepository(LectureEntity)
    private readonly lectureRepository: Repository<LectureEntity>,
    private readonly entityManager: EntityManager,
    private readonly classService: ClassService,
    private readonly courseService: CourseService,
    private readonly groupService: GroupService,
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

      // Tạo context nếu có classId, courseId hoặc groupId
      if (dto.classId || dto.courseId || dto.groupId) {
        if (dto.classId) {
          await this.classService.findOne(dto.classId);
        }

        if (dto.courseId) {
          await this.courseService.findOne(dto.courseId);
        }

        if (dto.groupId) {
          await this.groupService.checkById(dto.groupId);
        }

        await manager.save(LectureContextEntity, {
          lectureId: saved.id,
          classId: dto.classId || null,
          courseId: dto.courseId || null,
          groupId: dto.groupId || null,
          createdBy: user.userId,
        });
      }

      return saved;
    });
  }

  async findAll(): Promise<LectureResponseDto[]> {
    const lectures = await this.lectureRepository.find({
      relations: ['resources'],
      order: { orderColumn: 'ASC' },
    });
    return lectures;
  }

  async findOne(id: string): Promise<LectureResponseDto> {
    const lecture = await this.lectureRepository.findOne({
      where: { id },
      relations: ['resources'],
    });

    if (!lecture) {
      throw new NotFoundException(
        ERROR_MESSAGES.NOT_FOUND_WITH_ID('Lecture', id),
      );
    }

    return lecture;
  }

  async update(
    id: string,
    dto: UpdateLectureDto,
    user: JwtPayload,
  ): Promise<LectureResponseDto> {
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
      if (
        dto.classId !== undefined ||
        dto.courseId !== undefined ||
        dto.groupId !== undefined
      ) {
        if (dto.classId) {
          await this.classService.findOne(dto.classId);
        }

        if (dto.courseId) {
          await this.courseService.findOne(dto.courseId);
        }

        if (dto.groupId) {
          await this.groupService.checkById(dto.groupId);
        }

        const existingContext = await manager.findOne(LectureContextEntity, {
          where: { lectureId: id },
        });

        if (existingContext) {
          // Cập nhật context hiện tại
          if (dto.classId !== undefined)
            existingContext.classId = dto.classId || null;
          if (dto.courseId !== undefined)
            existingContext.courseId = dto.courseId || null;
          if (dto.groupId !== undefined)
            existingContext.groupId = dto.groupId || null;
          existingContext.updatedBy = user.userId;
          await manager.save(existingContext);
        } else {
          // Tạo context mới nếu có thông tin phân bổ
          if (dto.classId || dto.courseId || dto.groupId) {
            await manager.save(LectureContextEntity, {
              lectureId: id,
              classId: dto.classId || null,
              courseId: dto.courseId || null,
              groupId: dto.groupId || null,
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

      // Xoá lecture sẽ tự động xoá lecture_context và lecture_resource nhờ onDelete: CASCADE
      await manager.delete(LectureEntity, { id });
    });
  }
}
