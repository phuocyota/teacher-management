import {
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QuestionBankQuestionEntity } from './question-bank-question.entity';
import {
  CreateQuestionBankQuestionDto,
  UpdateQuestionBankQuestionDto,
} from './dto/create-question-bank-question.dto';
import { QuestionBankService } from 'src/question-bank/services/question-bank.service';
import { QuestionService } from 'src/question/question.service';
import {
  ENTITY_NAMES,
  ERROR_MESSAGES,
} from 'src/common/constant/error-messages.constant';
import { PaginationResponseDto } from 'src/common/dto/pagination.dto';
import { QuestionBankQuestionResponseDto } from './dto/question-bank-question.dto';
import { autoMapListToDto } from 'src/common/utils/auto-map.util';

@Injectable()
export class QuestionBankQuestionService {
  constructor(
    @InjectRepository(QuestionBankQuestionEntity)
    private readonly questionBankQuestionRepo: Repository<QuestionBankQuestionEntity>,
    @Inject(forwardRef(() => QuestionBankService))
    private readonly questionBankService: QuestionBankService,
    @Inject(forwardRef(() => QuestionService))
    private readonly questionService: QuestionService,
  ) {}

  async create(
    dto: CreateQuestionBankQuestionDto,
  ): Promise<QuestionBankQuestionEntity> {
    await this.questionBankService.findOne(dto.questionBankId);
    await this.questionService.findOne(dto.questionId);

    const record = this.questionBankQuestionRepo.create(dto);
    return this.questionBankQuestionRepo.save(record);
  }

  async findAll(
    page = 1,
    size = 10,
    questionBankId?: string,
    questionId?: string,
  ): Promise<PaginationResponseDto<QuestionBankQuestionResponseDto>> {
    const skip = (page - 1) * size;

    const qb = this.questionBankQuestionRepo.createQueryBuilder('qbq');

    if (questionBankId) {
      qb.andWhere('qbq.question_bank_id = :questionBankId', { questionBankId });
    }

    if (questionId) {
      qb.andWhere('qbq.question_id = :questionId', { questionId });
    }

    qb.orderBy('qbq.order_no', 'ASC');
    qb.skip(skip).take(size);

    const [data, total] = await qb.getManyAndCount();

    return {
      data: autoMapListToDto(QuestionBankQuestionResponseDto, data),
      page,
      size,
      total,
    };
  }

  async findOne(id: string): Promise<QuestionBankQuestionEntity> {
    const record = await this.questionBankQuestionRepo.findOne({
      where: { id },
    });

    if (!record) {
      throw new NotFoundException(
        ERROR_MESSAGES.NOT_FOUND_WITH_ID(
          ENTITY_NAMES.QUESTION_BANK_QUESTION ?? 'Liên kết ngân hàng câu hỏi',
          id,
        ),
      );
    }

    return record;
  }

  async findFirstByQuestionId(
    questionId: string,
  ): Promise<QuestionBankQuestionEntity | null> {
    return this.questionBankQuestionRepo.findOne({
      where: { questionId },
      order: { orderNo: 'ASC' },
    });
  }

  async assignQuestionToBank(
    questionId: string,
    questionBankId: string,
  ): Promise<QuestionBankQuestionEntity> {
    const existingLink = await this.findFirstByQuestionId(questionId);

    if (existingLink) {
      existingLink.questionBankId = questionBankId;
      return this.questionBankQuestionRepo.save(existingLink);
    }

    const existingCount = await this.questionBankQuestionRepo.count({
      where: { questionBankId },
    });

    const record = this.questionBankQuestionRepo.create({
      questionBankId,
      questionId,
      orderNo: existingCount + 1,
      points: 1,
    });

    return this.questionBankQuestionRepo.save(record);
  }

  async update(
    id: string,
    dto: UpdateQuestionBankQuestionDto,
  ): Promise<QuestionBankQuestionEntity> {
    const record = await this.findOne(id);

    if (dto.questionBankId !== undefined) {
      await this.questionBankService.findOne(dto.questionBankId);
      record.questionBankId = dto.questionBankId;
    }

    if (dto.questionId !== undefined) {
      await this.questionService.findOne(dto.questionId);
      record.questionId = dto.questionId;
    }

    if (dto.orderNo !== undefined) {
      record.orderNo = dto.orderNo;
    }

    if (dto.points !== undefined) {
      record.points = dto.points;
    }

    return this.questionBankQuestionRepo.save(record);
  }

  async remove(id: string): Promise<void> {
    const record = await this.findOne(id);
    await this.questionBankQuestionRepo.remove(record);
  }
}
