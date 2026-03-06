import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExamSetQuestionBankEntity } from './exam-set-question-bank.entity';
import {
  CreateExamSetQuestionBankDto,
  UpdateExamSetQuestionBankDto,
} from './dto/create-exam-set-question-bank.dto';
import {
  ERROR_MESSAGES,
  ENTITY_NAMES,
} from 'src/common/constant/error-messages.constant';
import { PaginationResponseDto } from 'src/common/dto/pagination.dto';
import { autoMapListToDto } from 'src/common/utils/auto-map.util';
import { ExamSetQuestionBankResponseDto } from './dto/exam-set-question-bank.dto';
import { ExamSetService } from 'src/exam-set/exam-set.service';
import { QuestionBankService } from 'src/question-bank/question-bank.service';
import { BadRequestException } from '@nestjs/common';

@Injectable()
export class ExamSetQuestionBankService {
  constructor(
    @InjectRepository(ExamSetQuestionBankEntity)
    private readonly examSetQuestionBankRepo: Repository<ExamSetQuestionBankEntity>,
    private readonly examSetService: ExamSetService,
    private readonly questionBankService: QuestionBankService,
  ) {}

  async create(
    dto: CreateExamSetQuestionBankDto,
  ): Promise<ExamSetQuestionBankEntity> {
    const examSet = await this.examSetService.findOne(dto.examSetId);
    const questionBank = await this.questionBankService.findOne(dto.questionBankId);

    const record = this.examSetQuestionBankRepo.create({
      examSetId: examSet.id,
      questionBankId: questionBank.id,
      order: dto.order,
      examSet,
      questionBank,
    });

    return this.examSetQuestionBankRepo.save(record);
  }

  async findAll(
    page = 1,
    size = 10,
    examSetId?: string,
    questionBankId?: string,
  ): Promise<PaginationResponseDto<ExamSetQuestionBankResponseDto>> {
    const skip = (page - 1) * size;

    const qb = this.examSetQuestionBankRepo.createQueryBuilder('esqb');

    if (examSetId) {
      qb.andWhere('esqb.exam_set_id = :examSetId', { examSetId });
    }

    if (questionBankId) {
      qb.andWhere('esqb.question_bank_id = :questionBankId', { questionBankId });
    }

    qb.orderBy('esqb.order', 'ASC');
    qb.skip(skip).take(size);

    const [data, total] = await qb.getManyAndCount();

    return {
      data: autoMapListToDto(ExamSetQuestionBankResponseDto, data),
      page,
      size,
      total,
    };
  }

  async findOne(id: string): Promise<ExamSetQuestionBankEntity> {
    const record = await this.examSetQuestionBankRepo.findOne({
      where: { id },
      relations: ['examSet', 'questionBank'],
    });

    if (!record) {
      throw new NotFoundException(
        ERROR_MESSAGES.NOT_FOUND_WITH_ID(
          ENTITY_NAMES.EXAM_SET_QUESTION_BANK ?? 'Lien ket bo de thi',
          id,
        ),
      );
    }

    return record;
  }

  async validateExamSetQuestionBank(
    examSetId: string,
    questionBankId: string,
  ): Promise<void> {
    const record = await this.examSetQuestionBankRepo.findOne({
      where: { examSetId, questionBankId },
    });

    if (!record) {
      throw new BadRequestException(
        ERROR_MESSAGES.QUESTION_BANK_NOT_IN_EXAM_SET,
      );
    }
  }

  async update(
    id: string,
    dto: UpdateExamSetQuestionBankDto,
  ): Promise<ExamSetQuestionBankEntity> {
    const record = await this.findOne(id);

    if (dto.examSetId !== undefined) {
      const examSet = await this.examSetService.findOne(dto.examSetId);
      record.examSet = examSet;
      record.examSetId = examSet.id;
    }

    if (dto.questionBankId !== undefined) {
      const questionBank = await this.questionBankService.findOne(
        dto.questionBankId,
      );
      record.questionBank = questionBank;
      record.questionBankId = questionBank.id;
    }

    if (dto.order !== undefined) {
      record.order = dto.order;
    }

    return this.examSetQuestionBankRepo.save(record);
  }

  async remove(id: string): Promise<void> {
    const record = await this.findOne(id);
    await this.examSetQuestionBankRepo.remove(record);
  }
}
