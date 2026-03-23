import {
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QuestionEntity } from './question.entity';
import {
  CreateQuestionDto,
  UpdateQuestionDto,
} from './dto/create-question.dto';
import { QuestionBankService } from 'src/question-bank/question-bank.service';
import {
  ERROR_MESSAGES,
  ENTITY_NAMES,
} from 'src/common/constant/error-messages.constant';
import { PaginationResponseDto } from 'src/common/dto/pagination.dto';
import { QuestionResponseDto } from './dto/question.dto';
import { autoMapListToDto } from 'src/common/utils/auto-map.util';
import { QuestionBankQuestionEntity } from 'src/question-bank-question/question-bank-question.entity';
import { QuestionBankQuestionService } from 'src/question-bank-question/question-bank-question.service';

@Injectable()
export class QuestionService {
  constructor(
    @InjectRepository(QuestionEntity)
    private readonly questionRepo: Repository<QuestionEntity>,
    @Inject(forwardRef(() => QuestionBankService))
    private readonly questionBankService: QuestionBankService,
    @Inject(forwardRef(() => QuestionBankQuestionService))
    private readonly questionBankQuestionService: QuestionBankQuestionService,
  ) {}

  async create(dto: CreateQuestionDto): Promise<QuestionEntity> {
    const record = this.questionRepo.create({
      contentType: dto.contentType,
      content: dto.content,
      nextContent: dto.nextContent,
      isRoot: !dto.previousId,
    });

    const savedRecord = await this.questionRepo.save(record);

    if (dto.previousId) {
      const previousQuestion = await this.findOne(dto.previousId);
      previousQuestion.nextContent = savedRecord.id;
      await this.questionRepo.save(previousQuestion);
    }

    if (dto.nextContent && !dto.previousId) {
      const nextQuestion = await this.questionRepo.findOne({
        where: { id: dto.nextContent },
      });

      if (nextQuestion && nextQuestion.isRoot) {
        nextQuestion.isRoot = false;
        await this.questionRepo.save(nextQuestion);
      }

      const questionBankLink =
        await this.questionBankQuestionService.findFirstByQuestionId(
          dto.nextContent,
        );

      if (questionBankLink) {
        questionBankLink.questionId = savedRecord.id;
        await this.questionBankQuestionService.update(questionBankLink.id, {
          questionId: savedRecord.id,
        });
      }
    }

    return savedRecord;
  }

  async findAll(
    page = 1,
    size = 10,
    questionBankId?: string,
    questionType?: string,
  ): Promise<PaginationResponseDto<QuestionResponseDto>> {
    const skip = (page - 1) * size;

    const qb = this.questionRepo.createQueryBuilder('question');

    if (questionBankId) {
      qb.innerJoin(
        QuestionBankQuestionEntity,
        'qbq',
        'qbq.question_id = question.id AND qbq.question_bank_id = :questionBankId',
        { questionBankId },
      );
      qb.addSelect('qbq.question_bank_id', 'questionBankId');
      qb.addSelect('qbq.order_no', 'orderNo');
    } else {
      qb.leftJoin(
        QuestionBankQuestionEntity,
        'qbq',
        'qbq.question_id = question.id',
      );
      qb.addSelect('qbq.question_bank_id', 'questionBankId');
      qb.addSelect('qbq.order_no', 'orderNo');
    }

    if (questionType) {
      qb.andWhere('question.content_type = :questionType', { questionType });
    }

    qb.andWhere('question.isRoot = :isRoot', { isRoot: true });

    if (questionBankId) {
      qb.orderBy('qbq.orderNo', 'ASC');
    } else {
      qb.orderBy('question.createdAt', 'DESC');
    }
    qb.skip(skip).take(size);

    const { entities, raw } = await qb.getRawAndEntities();
    const total = await qb.clone().skip(undefined).take(undefined).getCount();

    const questionsWithDetails = await Promise.all(
      entities.map(async (question, index) => {
        if (raw[index]?.questionBankId) {
          (question as any).questionBankId = raw[index].questionBankId;
        }

        if (question.nextContent) {
          const nextContentEntity = await this.questionRepo.findOne({
            where: { id: question.nextContent },
            select: ['id', 'content', 'contentType'],
          });

          if (nextContentEntity) {
            (question as any).nextContentDetails = {
              id: nextContentEntity.id,
              content: nextContentEntity.content,
              contentType: nextContentEntity.contentType,
            };
          }

        }
        return question;
      }),
    );

    return {
      data: autoMapListToDto(QuestionResponseDto, questionsWithDetails),
      page,
      size,
      total,
    };
  }

  async findOne(id: string): Promise<QuestionEntity> {
    const record = await this.questionRepo.findOne({
      where: { id },
    });
    if (!record) {
      throw new NotFoundException(
        ERROR_MESSAGES.NOT_FOUND_WITH_ID(
          ENTITY_NAMES.QUESTION ?? 'Câu hỏi',
          id,
        ),
      );
    }

    // Load nextContent details if exists
    if (record.nextContent) {
      const nextContentEntity = await this.questionRepo.findOne({
        where: { id: record.nextContent },
        select: ['id', 'content', 'contentType'],
      });

      if (nextContentEntity) {
        (record as any).nextContentDetails = {
          id: nextContentEntity.id,
          content: nextContentEntity.content,
          contentType: nextContentEntity.contentType,
        };
      }

    }

    const questionBankLink =
      await this.questionBankQuestionService.findFirstByQuestionId(record.id);

    if (questionBankLink) {
      (record as any).questionBankId = questionBankLink.questionBankId;
    }

    return record;
  }

  async update(id: string, dto: UpdateQuestionDto): Promise<QuestionEntity> {
    const record = await this.findOne(id);

    if (dto.questionBankId !== undefined) {
      await this.questionBankService.findOne(dto.questionBankId);
      await this.questionBankQuestionService.assignQuestionToBank(
        id,
        dto.questionBankId,
      );
    }

    if (dto.contentType !== undefined) {
      record.contentType = dto.contentType;
    }

    if (dto.content !== undefined) {
      record.content = dto.content;
    }

    if (dto.nextContent !== undefined) {
      record.nextContent = dto.nextContent;
    }

    return this.questionRepo.save(record);
  }

  async remove(id: string): Promise<void> {
    const record = await this.findOne(id);
    await this.questionRepo.remove(record);
  }

  async createBulk(
    questions: Partial<QuestionEntity>[],
  ): Promise<QuestionEntity[]> {
    const records = this.questionRepo.create(questions);
    return this.questionRepo.save(records);
  }

  async updateBulk(
    questions: Partial<QuestionEntity>[],
  ): Promise<QuestionEntity[]> {
    return this.questionRepo.save(questions);
  }

  /**
   * Get question with full content chain (following nextContent links)
   * Returns array of question parts in order
   */
  async getQuestionWithChain(id: string): Promise<QuestionEntity[]> {
    const chain: QuestionEntity[] = [];
    let currentId: string | undefined = id;

    // Follow the chain up to 10 levels (prevent infinite loops)
    const maxDepth = 10;
    let depth = 0;

    while (currentId && depth < maxDepth) {
      const question = await this.questionRepo.findOne({
        where: { id: currentId },
        relations: ['answers'],
      });

      if (!question) {
        break;
      }

      chain.push(question);
      currentId = question.nextContent;
      depth++;
    }

    if (chain.length === 0) {
      throw new NotFoundException(
        ERROR_MESSAGES.NOT_FOUND_WITH_ID(
          ENTITY_NAMES.QUESTION ?? 'Câu hỏi',
          id,
        ),
      );
    }

    return chain;
  }
}
