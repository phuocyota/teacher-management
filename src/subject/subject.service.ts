import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SubjectEntity } from './subject.entity';
import { CreateSubjectDto, UpdateSubjectDto } from './dto/create-subject.dto';
import {
  ERROR_MESSAGES,
  ENTITY_NAMES,
} from 'src/common/constant/error-messages.constant';
import { PaginationResponseDto } from 'src/common/dto/pagination.dto';
import { SubjectResponseDto } from './dto/subject.dto';
import { autoMapListToDto } from 'src/common/utils/auto-map.util';

@Injectable()
export class SubjectService {
  constructor(
    @InjectRepository(SubjectEntity)
    private readonly subjectRepo: Repository<SubjectEntity>,
  ) {}

  async create(dto: CreateSubjectDto): Promise<SubjectEntity> {
    const record = this.subjectRepo.create({
      code: dto.code,
      name: dto.name,
    });
    return this.subjectRepo.save(record);
  }

  async findAll(
    page = 1,
    size = 10,
    search?: string,
  ): Promise<PaginationResponseDto<SubjectResponseDto>> {
    const skip = (page - 1) * size;

    const qb = this.subjectRepo.createQueryBuilder('s');

    if (search) {
      qb.andWhere('s.name ILIKE :search OR s.code ILIKE :search', {
        search: `%${search}%`,
      });
    }

    qb.orderBy('s.code', 'ASC');
    qb.skip(skip).take(size);

    const [data, total] = await qb.getManyAndCount();

    return {
      data: autoMapListToDto(SubjectResponseDto, data),
      page,
      size,
      total,
    };
  }

  async findOne(id: string): Promise<SubjectEntity> {
    const record = await this.subjectRepo.findOne({ where: { id } });
    if (!record) {
      throw new NotFoundException(
        ERROR_MESSAGES.NOT_FOUND_WITH_ID(ENTITY_NAMES.SUBJECT ?? 'Mon hoc', id),
      );
    }
    return record;
  }

  async update(id: string, dto: UpdateSubjectDto): Promise<SubjectEntity> {
    const record = await this.findOne(id);

    if (dto.code !== undefined) {
      record.code = dto.code;
    }

    if (dto.name !== undefined) {
      record.name = dto.name;
    }

    return this.subjectRepo.save(record);
  }

  async remove(id: string): Promise<void> {
    const record = await this.findOne(id);
    await this.subjectRepo.remove(record);
  }
}
