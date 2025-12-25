import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { CourseEntity } from './course.entity';
import { CreateCourseDto, UpdateCourseDto } from './dto/create-course.dto';
import {
  ERROR_MESSAGES,
  ENTITY_NAMES,
} from 'src/common/constant/error-messages.constant';

@Injectable()
export class CourseService {
  constructor(
    @InjectRepository(CourseEntity)
    private readonly courseRepo: Repository<CourseEntity>,
  ) {}

  async create(dto: CreateCourseDto): Promise<CourseEntity> {
    const record = this.courseRepo.create(dto);
    return this.courseRepo.save(record);
  }

  async findAll(
    page = 1,
    size = 10,
    q?: string,
  ): Promise<{
    data: CourseEntity[];
    page: number;
    size: number;
    total: number;
  }> {
    const skip = (page - 1) * size;
    let where: any = undefined;
    if (q) {
      // OR search on code or name
      where = [{ code: Like(`%${q}%`) }, { name: Like(`%${q}%`) }];
    }

    const [data, total] = await this.courseRepo.findAndCount({
      where,
      skip,
      take: size,
      order: { name: 'ASC' },
    });

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
    const updated = Object.assign(record, dto);
    return this.courseRepo.save(updated);
  }

  async remove(id: string): Promise<void> {
    const record = await this.findOne(id);
    await this.courseRepo.remove(record);
  }
}
