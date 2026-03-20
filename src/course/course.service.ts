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
import {
  ERROR_MESSAGES,
  ENTITY_NAMES,
} from 'src/common/constant/error-messages.constant';
import { UploadService } from 'src/upload/upload.service';
import { JwtPayload } from 'src/common/interface/jwt-payload.interface';
import { PaginationResponseDto } from 'src/common/dto/pagination.dto';
import { CourseOptionDto, CourseResponseDto } from './dto/course.dto';

@Injectable()
export class CourseService {
  constructor(
    @InjectRepository(CourseEntity)
    private readonly courseRepo: Repository<CourseEntity>,
    @InjectRepository(ClassEntity)
    private readonly classRepo: Repository<ClassEntity>,
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
  ): Promise<PaginationResponseDto<CourseOptionDto>> {
    const skip = (page - 1) * size;

    const qb = this.courseRepo
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

    if (q) {
      const qParam = `%${q}%`;
      qb.andWhere(
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
