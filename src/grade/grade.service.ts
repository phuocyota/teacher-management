import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GradeEntity } from './grade.entity';
import { CreateGradeDto, UpdateGradeDto } from './dto/create-grade.dto';
import {
  ERROR_MESSAGES,
  ENTITY_NAMES,
} from 'src/common/constant/error-messages.constant';
import { PaginationResponseDto } from 'src/common/dto/pagination.dto';
import { GradeResponseDto } from './dto/grade.dto';
import { autoMapListToDto } from 'src/common/utils/auto-map.util';

@Injectable()
export class GradeService {
  constructor(
    @InjectRepository(GradeEntity)
    private readonly gradeRepo: Repository<GradeEntity>,
  ) {}

  async create(dto: CreateGradeDto): Promise<GradeEntity> {
    const record = this.gradeRepo.create({
      code: dto.code,
      name: dto.name,
    });
    return this.gradeRepo.save(record);
  }

  async findAll(
    page = 1,
    size = 10,
    search?: string,
  ): Promise<PaginationResponseDto<GradeResponseDto>> {
    const skip = (page - 1) * size;

    const qb = this.gradeRepo.createQueryBuilder('g');

    if (search) {
      qb.andWhere('g.name ILIKE :search OR g.code ILIKE :search', {
        search: `%${search}%`,
      });
    }

    qb.orderBy('g.code', 'ASC');
    qb.skip(skip).take(size);

    const [data, total] = await qb.getManyAndCount();

    return {
      data: autoMapListToDto(GradeResponseDto, data),
      page,
      size,
      total,
    };
  }

  async findOne(id: string): Promise<GradeEntity> {
    const record = await this.gradeRepo.findOne({ where: { id } });
    if (!record) {
      throw new NotFoundException(
        ERROR_MESSAGES.NOT_FOUND_WITH_ID(ENTITY_NAMES.GRADE ?? 'Khối', id),
      );
    }
    return record;
  }

  async update(id: string, dto: UpdateGradeDto): Promise<GradeEntity> {
    const record = await this.findOne(id);

    if (dto.code !== undefined) {
      record.code = dto.code;
    }

    if (dto.name !== undefined) {
      record.name = dto.name;
    }

    return this.gradeRepo.save(record);
  }

  async remove(id: string): Promise<void> {
    const record = await this.findOne(id);
    await this.gradeRepo.remove(record);
  }
}
