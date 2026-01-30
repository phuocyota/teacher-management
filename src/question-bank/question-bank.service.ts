import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QuestionBankEntity } from './question-bank.entity';
import {
  CreateQuestionBankDto,
  UpdateQuestionBankDto,
} from './dto/create-question-bank.dto';
import { ClassService } from 'src/class/class.service';
import {
  ERROR_MESSAGES,
  ENTITY_NAMES,
} from 'src/common/constant/error-messages.constant';
import { PaginationResponseDto } from 'src/common/dto/pagination.dto';
import { QuestionBankResponseDto } from './dto/question-bank.dto';
import { autoMapListToDto } from 'src/common/utils/auto-map.util';

@Injectable()
export class QuestionBankService {
  constructor(
    @InjectRepository(QuestionBankEntity)
    private readonly questionBankRepo: Repository<QuestionBankEntity>,
    private readonly classService: ClassService,
  ) {}

  async create(dto: CreateQuestionBankDto): Promise<QuestionBankEntity> {
    // Validate classId exists
    const cls = await this.classService.findOne(dto.classId);

    const record = this.questionBankRepo.create({
      totalMarks: dto.totalMarks,
      examDate: dto.examDate,
      class: cls,
    });
    return this.questionBankRepo.save(record);
  }

  async findAll(
    page = 1,
    size = 10,
    classId?: string,
    examDate?: string,
  ): Promise<PaginationResponseDto<QuestionBankResponseDto>> {
    const skip = (page - 1) * size;

    const qb = this.questionBankRepo
      .createQueryBuilder('qb')
      .leftJoinAndSelect('qb.class', 'class');

    if (classId) {
      qb.andWhere('qb.class_id = :classId', { classId });
    }

    if (examDate) {
      qb.andWhere('qb.exam_date = :examDate', { examDate });
    }

    qb.orderBy('qb.examDate', 'DESC');
    qb.skip(skip).take(size);

    const [data, total] = await qb.getManyAndCount();

    return {
      data: autoMapListToDto(QuestionBankResponseDto, data),
      page,
      size,
      total,
    };
  }

  async findOne(id: string): Promise<QuestionBankEntity> {
    const record = await this.questionBankRepo.findOne({
      where: { id },
      relations: ['class'],
    });
    if (!record) {
      throw new NotFoundException(
        ERROR_MESSAGES.NOT_FOUND_WITH_ID(
          ENTITY_NAMES.QUESTION_BANK ?? 'Question Bank',
          id,
        ),
      );
    }
    return record;
  }

  async update(
    id: string,
    dto: UpdateQuestionBankDto,
  ): Promise<QuestionBankEntity> {
    const record = await this.findOne(id);

    if (dto.classId) {
      const cls = await this.classService.findOne(dto.classId);
      record.class = cls;
    }

    if (dto.totalMarks !== undefined) {
      record.totalMarks = dto.totalMarks;
    }

    if (dto.examDate !== undefined) {
      record.examDate = dto.examDate;
    }

    return this.questionBankRepo.save(record);
  }

  async remove(id: string): Promise<void> {
    const record = await this.findOne(id);
    await this.questionBankRepo.remove(record);
  }
}
