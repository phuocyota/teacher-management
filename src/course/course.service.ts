import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { CourseEntity } from './course.entity';
import { CreateCourseDto, UpdateCourseDto } from './dto/create-course.dto';
import { ClassEntity } from 'src/class/class.entity';
import {
  ERROR_MESSAGES,
  ENTITY_NAMES,
} from 'src/common/constant/error-messages.constant';

@Injectable()
export class CourseService {
  constructor(
    @InjectRepository(CourseEntity)
    private readonly courseRepo: Repository<CourseEntity>,
    @InjectRepository(ClassEntity)
    private readonly classRepo: Repository<ClassEntity>,
  ) {}

  async create(dto: CreateCourseDto): Promise<CourseEntity> {
    // If classId provided, validate it exists
    if (dto.classId) {
      const cls = await this.classRepo.findOne({ where: { id: dto.classId } });
      if (!cls) {
        throw new BadRequestException('classId không tồn tại');
      }
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
  ): Promise<{
    data: CourseEntity[];
    page: number;
    size: number;
    total: number;
  }> {
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

  async update(id: string, dto: UpdateCourseDto): Promise<CourseEntity> {
    const record = await this.findOne(id);
    if (dto.classId) {
      const cls = await this.classRepo.findOne({ where: { id: dto.classId } });
      if (!cls) {
        throw new BadRequestException('classId không tồn tại');
      }
    }

    const updated = Object.assign(record, dto as any);
    return this.courseRepo.save(updated);
  }

  async remove(id: string): Promise<void> {
    const record = await this.findOne(id);
    await this.courseRepo.remove(record);
  }
}
