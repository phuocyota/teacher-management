import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExamSetEntity } from './exam-set.entity';
import { CreateExamSetDto, UpdateExamSetDto } from './dto/create-exam-set.dto';
import {
  ERROR_MESSAGES,
  ENTITY_NAMES,
} from 'src/common/constant/error-messages.constant';
import { PaginationResponseDto } from 'src/common/dto/pagination.dto';
import { ExamSetResponseDto } from './dto/exam-set.dto';
import { autoMapListToDto } from 'src/common/utils/auto-map.util';
import { ExamSetStatus } from './enum/exam-set-status.enum';
import { ClassService } from 'src/class/class.service';

@Injectable()
export class ExamSetService {
  constructor(
    @InjectRepository(ExamSetEntity)
    private readonly examSetRepo: Repository<ExamSetEntity>,
    private readonly classService: ClassService,
  ) {}

  async create(dto: CreateExamSetDto): Promise<ExamSetEntity> {
    const record = this.examSetRepo.create({
      name: dto.name,
      description: dto.description,
      status: dto.status ?? ExamSetStatus.DRAFT,
    });

    if (dto.classId) {
      const cls = await this.classService.findOne(dto.classId);
      record.class = cls;
      record.classId = cls.id;
    }

    return this.examSetRepo.save(record);
  }

  async findAll(
    page = 1,
    size = 10,
    classId?: string,
    gradeId?: string,
    subjectId?: string,
    status?: ExamSetStatus,
    search?: string,
  ): Promise<PaginationResponseDto<ExamSetResponseDto>> {
    const skip = (page - 1) * size;

    const qb = this.examSetRepo
      .createQueryBuilder('es')
      .leftJoin('es.class', 'class');

    if (classId) {
      qb.andWhere('es.class_id = :classId', { classId });
    }

    if (gradeId) {
      qb.andWhere('class.grade_id = :gradeId', { gradeId });
    }

    if (subjectId) {
      qb.andWhere('class.subject_id = :subjectId', { subjectId });
    }

    if (status) {
      qb.andWhere('es.status = :status', { status });
    }

    if (search) {
      qb.andWhere('(es.name ILIKE :search OR es.description ILIKE :search)', {
        search: `%${search}%`,
      });
    }

    qb.orderBy('es.createdAt', 'DESC');
    qb.skip(skip).take(size);

    const [data, total] = await qb.getManyAndCount();

    return {
      data: autoMapListToDto(ExamSetResponseDto, data),
      page,
      size,
      total,
    };
  }

  async findOne(id: string): Promise<ExamSetEntity> {
    const record = await this.examSetRepo.findOne({
      where: { id },
      relations: ['class'],
    });

    if (!record) {
      throw new NotFoundException(
        ERROR_MESSAGES.NOT_FOUND_WITH_ID(
          ENTITY_NAMES.EXAM_SET ?? 'Bo de thi',
          id,
        ),
      );
    }

    return record;
  }

  async update(id: string, dto: UpdateExamSetDto): Promise<ExamSetEntity> {
    const record = await this.findOne(id);

    if (dto.classId !== undefined) {
      if (dto.classId) {
        const cls = await this.classService.findOne(dto.classId);
        record.class = cls;
        record.classId = cls.id;
      } else {
        record.class = undefined;
        record.classId = undefined;
      }
    }

    if (dto.name !== undefined) {
      record.name = dto.name;
    }

    if (dto.description !== undefined) {
      record.description = dto.description;
    }

    if (dto.status !== undefined) {
      record.status = dto.status;
    }

    return this.examSetRepo.save(record);
  }

  async remove(id: string): Promise<void> {
    const record = await this.findOne(id);
    await this.examSetRepo.remove(record);
  }
}
