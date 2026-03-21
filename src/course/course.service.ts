import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CourseEntity } from './course.entity';
import { CreateCourseDto, UpdateCourseDto } from './dto/create-course.dto';
import { ClassEntity } from 'src/class/class.entity';
import { LectureEntity } from 'src/lecture/entity/lecture.entity';
import {
  ERROR_MESSAGES,
  ENTITY_NAMES,
} from 'src/common/constant/error-messages.constant';
import { UploadService } from 'src/upload/upload.service';
import { JwtPayload } from 'src/common/interface/jwt-payload.interface';
import { PaginationResponseDto } from 'src/common/dto/pagination.dto';
<<<<<<< HEAD
import {
  ClassOptionDto,
  CourseOptionDto,
  CourseResponseDto,
  LectureOptionDto,
} from './dto/course.dto';
=======
import { CourseOptionDto, CourseResponseDto } from './dto/course.dto';
>>>>>>> b3aba5bb7454c60bed62b01cee6c963b9afbc016

@Injectable()
export class CourseService {
  constructor(
    @InjectRepository(CourseEntity)
    private readonly courseRepo: Repository<CourseEntity>,
    @InjectRepository(ClassEntity)
    private readonly classRepo: Repository<ClassEntity>,
    @InjectRepository(LectureEntity)
    private readonly lectureRepo: Repository<LectureEntity>,
    private readonly uploadService: UploadService,
  ) {}

  async create(dto: CreateCourseDto): Promise<CourseEntity> {
    // If classId provided, validate it exists
    if (dto.classId) {
      const cls = await this.classRepo.findOne({ where: { id: dto.classId } });
      if (!cls) {
        throw new BadRequestException('classId không tồn tại');
      }
    }

    // Check duplicate code + classId (use QueryBuilder to handle NULL classId)
    const qbCheck = this.courseRepo
      .createQueryBuilder('c')
      .where('c.code = :code', {
        code: dto.code,
      });
    if (dto.classId) {
      qbCheck.andWhere('c.class_id = :classId', { classId: dto.classId });
    } else {
      qbCheck.andWhere('c.class_id IS NULL');
    }
    const existing = await qbCheck.getOne();
    if (existing) {
      throw new BadRequestException('Mã khóa học đã tồn tại trong lớp này');
    }

    const record = this.courseRepo.create(
      dto as unknown as Partial<CourseEntity>,
    );
    return this.courseRepo.save(record as CourseEntity);
  }

  async findAll(
    page = 1,
    size = 10,
    q?: string,
    classId?: string,
  ): Promise<PaginationResponseDto<CourseResponseDto>> {
    const skip = (page - 1) * size;

    const qb = this.courseRepo.createQueryBuilder('course');
    if (q) {
      const qParam = `%${q}%`;
      qb.andWhere(
        '(LOWER(course.code) LIKE LOWER(:q) OR LOWER(course.name) LIKE LOWER(:q))',
        {
          q: qParam,
        },
      );
    }

    if (classId) {
      qb.andWhere('course.class_id = :classId', { classId });
    }

    qb.orderBy('course.name', 'ASC');
    qb.skip(skip).take(size);

    const [data, total] = await qb.getManyAndCount();
    return { data, page, size, total };
  }

  async findOne(id: string): Promise<CourseEntity> {
    const record = await this.courseRepo.findOne({ where: { id } });
    if (!record) {
      throw new NotFoundException(
        ERROR_MESSAGES.NOT_FOUND_WITH_ID(ENTITY_NAMES.COURSE ?? 'Course', id),
      );
    }
    return record;
  }

  async getOptions(
    page = 1,
    size = 10,
    q?: string,
    classId?: string,
<<<<<<< HEAD
  ): Promise<
    PaginationResponseDto<CourseOptionDto> & {
      classes: ClassOptionDto[];
      courses: CourseOptionDto[];
      lectures: LectureOptionDto[];
    }
  > {
    const skip = (page - 1) * size;
    const qParam = q ? `%${q}%` : undefined;

    const coursesQb = this.courseRepo
=======
  ): Promise<PaginationResponseDto<CourseOptionDto>> {
    const skip = (page - 1) * size;

    const qb = this.courseRepo
>>>>>>> b3aba5bb7454c60bed62b01cee6c963b9afbc016
      .createQueryBuilder('course')
      .leftJoin('course.class', 'class')
      .select([
        'course.id AS "value"',
        'course.name AS "label"',
        'course.code AS "code"',
        'course.name AS "name"',
        'course.classId AS "classId"',
        'class.code AS "classCode"',
        'class.name AS "className"',
      ]);

<<<<<<< HEAD
    if (qParam) {
      coursesQb.andWhere(
=======
    if (q) {
      const qParam = `%${q}%`;
      qb.andWhere(
>>>>>>> b3aba5bb7454c60bed62b01cee6c963b9afbc016
        `(
          LOWER(course.code) LIKE LOWER(:q)
          OR LOWER(course.name) LIKE LOWER(:q)
          OR LOWER(class.code) LIKE LOWER(:q)
          OR LOWER(class.name) LIKE LOWER(:q)
        )`,
        { q: qParam },
      );
    }

    if (classId) {
<<<<<<< HEAD
      coursesQb.andWhere('course.class_id = :classId', { classId });
    }

    coursesQb.orderBy('class.name', 'ASC');
    coursesQb.addOrderBy('course.name', 'ASC');
    coursesQb.skip(skip).take(size);

    const classesQb = this.classRepo
      .createQueryBuilder('class')
      .select([
        'class.id AS "value"',
        "CONCAT(class.code, ' - ', class.name) AS \"label\"",
        'class.code AS "code"',
        'class.name AS "name"',
      ]);

    if (classId) {
      classesQb.andWhere('class.id = :classId', { classId });
    }

    if (qParam) {
      classesQb.andWhere(
        `(
          LOWER(class.code) LIKE LOWER(:q)
          OR LOWER(class.name) LIKE LOWER(:q)
        )`,
        { q: qParam },
      );
    }

    classesQb.orderBy('class.name', 'ASC');

    const lecturesQb = this.lectureRepo
      .createQueryBuilder('lecture')
      .innerJoin(CourseEntity, 'course', 'course.id = lecture.course_id')
      .innerJoin(ClassEntity, 'class', 'class.id = course.class_id')
      .select([
        'lecture.id AS "value"',
        'lecture.title AS "label"',
        'lecture.code AS "code"',
        'lecture.title AS "title"',
        'class.id AS "classId"',
        'course.id AS "courseId"',
      ]);

    if (classId) {
      lecturesQb.andWhere('class.id = :classId', { classId });
    }

    if (qParam) {
      lecturesQb.andWhere(
        `(
          LOWER(lecture.code) LIKE LOWER(:q)
          OR LOWER(lecture.title) LIKE LOWER(:q)
          OR LOWER(course.code) LIKE LOWER(:q)
          OR LOWER(course.name) LIKE LOWER(:q)
          OR LOWER(class.code) LIKE LOWER(:q)
          OR LOWER(class.name) LIKE LOWER(:q)
        )`,
        { q: qParam },
      );
    }

    lecturesQb.orderBy('lecture.order_column', 'ASC');
    lecturesQb.addOrderBy('lecture.title', 'ASC');

    const [data, total, classes, lectures] = await Promise.all([
      coursesQb.getRawMany<CourseOptionDto>(),
      coursesQb.getCount(),
      classesQb.getRawMany<ClassOptionDto>(),
      lecturesQb.getRawMany<LectureOptionDto>(),
    ]);

    return {
      data,
      classes,
      courses: data,
      lectures,
      page,
      size,
      total,
    };
=======
      qb.andWhere('course.class_id = :classId', { classId });
    }

    qb.orderBy('class.name', 'ASC');
    qb.addOrderBy('course.name', 'ASC');
    qb.skip(skip).take(size);

    const [data, total] = await Promise.all([
      qb.getRawMany<CourseOptionDto>(),
      qb.getCount(),
    ]);

    return { data, page, size, total };
>>>>>>> b3aba5bb7454c60bed62b01cee6c963b9afbc016
  }

  async update(id: string, dto: UpdateCourseDto): Promise<CourseEntity> {
    const record = await this.findOne(id);
    if (dto.classId) {
      const cls = await this.classRepo.findOne({ where: { id: dto.classId } });
      if (!cls) {
        throw new BadRequestException('classId không tồn tại');
      }
    }

    // Determine target code and classId after update
    const targetCode = (dto as any).code ?? record.code;
    const targetClassId = (dto as any).classId ?? record.classId;

    // Check conflict using QueryBuilder to handle NULL classId
    const qbConflict = this.courseRepo
      .createQueryBuilder('c')
      .where('c.code = :code', { code: targetCode });
    if (targetClassId) {
      qbConflict.andWhere('c.class_id = :classId', { classId: targetClassId });
    } else {
      qbConflict.andWhere('c.class_id IS NULL');
    }
    const conflict = await qbConflict.getOne();
    if (conflict && conflict.id !== id) {
      throw new BadRequestException('Mã khóa học đã tồn tại trong lớp này');
    }

    const updated = Object.assign(record, dto as any);
    return this.courseRepo.save(updated);
  }

  async remove(id: string, user: JwtPayload): Promise<void> {
    const record = await this.findOne(id);
    if (record.image) {
      await this.uploadService.deleteFileByPath(record.image);
    }
    await this.courseRepo.remove(record);
  }

  async getMaxCode(): Promise<number> {
    // Sử dụng Postgres regex để lấy phần số và trả về MAX nhanh hơn
    const result = await this.courseRepo
      .createQueryBuilder('course')
      .select(
        "MAX(CASE WHEN regexp_replace(course.code, '\\D', '', 'g') = '' THEN 0 ELSE (regexp_replace(course.code, '\\D', '', 'g'))::int END)",
        'maxCode',
      )
      .getRawOne<{ maxCode: number | null }>();

    return result?.maxCode ?? 0;
  }
}
