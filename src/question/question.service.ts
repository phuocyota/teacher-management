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
import { QuestionBankService } from 'src/question-bank/services/question-bank.service';
import {
  ERROR_MESSAGES,
  ENTITY_NAMES,
} from 'src/common/constant/error-messages.constant';
import { PaginationResponseDto } from 'src/common/dto/pagination.dto';
import { QuestionResponseDto } from './dto/question.dto';
import {
  QuestionChainResponseDto,
  QuestionChainNodeDto,
} from './dto/question.dto';
import { autoMapListToDto } from 'src/common/utils/auto-map.util';
import { QuestionBankQuestionEntity } from 'src/question-bank-question/question-bank-question.entity';
import { QuestionBankQuestionService } from 'src/question-bank-question/question-bank-question.service';
import { QuestionType } from './enum/question-type.enum';
import { AnswerEntity } from 'src/answer/answer.entity';
import { ContentTypes } from 'src/common/enum/content-type.enum';
import { UploadService } from 'src/upload/upload.service';

@Injectable()
export class QuestionService {
  constructor(
    @InjectRepository(QuestionEntity)
    private readonly questionRepo: Repository<QuestionEntity>,
    @InjectRepository(AnswerEntity)
    private readonly answerRepo: Repository<AnswerEntity>,
    @Inject(forwardRef(() => QuestionBankService))
    private readonly questionBankService: QuestionBankService,
    @Inject(forwardRef(() => QuestionBankQuestionService))
    private readonly questionBankQuestionService: QuestionBankQuestionService,
    private readonly uploadService: UploadService,
  ) {}

  async create(dto: CreateQuestionDto): Promise<QuestionEntity> {
    const record = this.questionRepo.create({
      type: dto.type ?? QuestionType.SINGLE_CHOICE,
      contentType: dto.contentType,
      content: dto.content,
      meta: dto.meta,
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
    type?: QuestionType,
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
      // Required for TypeORM pagination with ORDER BY joined column.
      qb.addSelect('qbq.orderNo');
    }

    if (questionType) {
      qb.andWhere('question.content_type = :questionType', { questionType });
    }

    if (type) {
      qb.andWhere('question.question_type = :type', { type });
    }

    qb.andWhere('question.isRoot = :isRoot', { isRoot: true });

    if (questionBankId) {
      qb.orderBy('qbq.orderNo', 'ASC');
    } else {
      qb.orderBy('question.createdAt', 'DESC');
    }
    qb.skip(skip).take(size);

    const [entities, total] = await qb.getManyAndCount();

    const questionsWithDetails = await Promise.all(
      entities.map(async (question) => {
        if (questionBankId) {
          (question as any).questionBankId = questionBankId;
        }

        if (question.nextContent) {
          const nextContentEntity = await this.questionRepo.findOne({
            where: { id: question.nextContent },
            select: ['id', 'type', 'content', 'contentType', 'meta'],
          });

          if (nextContentEntity) {
            (question as any).nextContentDetails = {
              id: nextContentEntity.id,
              type: nextContentEntity.type,
              content: nextContentEntity.content,
              contentType: nextContentEntity.contentType,
              meta: nextContentEntity.meta,
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
        select: ['id', 'type', 'content', 'contentType', 'meta'],
      });

      if (nextContentEntity) {
        (record as any).nextContentDetails = {
          id: nextContentEntity.id,
          type: nextContentEntity.type,
          content: nextContentEntity.content,
          contentType: nextContentEntity.contentType,
          meta: nextContentEntity.meta,
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

    if (dto.type !== undefined) {
      record.type = dto.type;
    }

    if (dto.content !== undefined) {
      record.content = dto.content;
    }

    if (dto.meta !== undefined) {
      record.meta = dto.meta;
    }

    if (dto.nextContent !== undefined) {
      record.nextContent = dto.nextContent;
    }

    return this.questionRepo.save(record);
  }

  async remove(id: string): Promise<void> {
    const questionChain = await this.getQuestionChainEntities(id);
    const questionIds = questionChain.map((question) => question.id);
    const answerChains = await this.getAnswerChainsForQuestions(questionIds);

    await this.deleteImagesFromAnswers(answerChains.flat());
    await this.deleteImagesFromQuestions(questionChain);

    const answersToDelete = answerChains.flat();
    if (answersToDelete.length > 0) {
      await this.answerRepo.remove(answersToDelete);
    }

    if (questionChain.length > 0) {
      await this.questionRepo.remove(questionChain);
    }
  }

  async createBulk(
    questions: Partial<QuestionEntity>[],
  ): Promise<QuestionEntity[]> {
    const records = this.questionRepo.create(
      questions.map((question) => ({
        ...question,
        type: question.type ?? QuestionType.SINGLE_CHOICE,
      })),
    );
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
  async getQuestionWithChain(id: string): Promise<QuestionChainResponseDto> {
    const chain: QuestionEntity[] = [];
    let currentId: string | undefined = id;

    // Follow the chain up to 10 levels (prevent infinite loops)
    const maxDepth = 10;
    let depth = 0;

    while (currentId && depth < maxDepth) {
      const question = await this.questionRepo.findOne({
        where: { id: currentId },
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

    return this.buildChainResponse(chain);
  }

  private buildChainResponse(chain: QuestionEntity[]): QuestionChainResponseDto {
    const root = chain[0];

    return {
      id: root.id,
      type: root.type,
      contentType: root.contentType,
      content: root.content,
      meta: root.meta,
      nextContent: root.nextContent ?? chain[1]?.id ?? null,
      chain: chain.map((question, index) => this.toChainNode(question, chain[index + 1])),
    };
  }

  private toChainNode(
    question: QuestionEntity,
    nextQuestion?: QuestionEntity,
  ): QuestionChainNodeDto {
    return {
      id: question.id,
      content: question.content,
      contentType: question.contentType,
      meta: question.meta,
      nextContent: nextQuestion?.id ?? question.nextContent ?? null,
    };
  }

  private async getQuestionChainEntities(id: string): Promise<QuestionEntity[]> {
    const chain: QuestionEntity[] = [];
    let currentId: string | undefined = id;
    const visited = new Set<string>();

    while (currentId && !visited.has(currentId)) {
      const question = await this.questionRepo.findOne({
        where: { id: currentId },
      });

      if (!question) {
        break;
      }

      chain.push(question);
      visited.add(question.id);
      currentId = question.nextContent;
    }

    if (chain.length === 0) {
      throw new NotFoundException(
        ERROR_MESSAGES.NOT_FOUND_WITH_ID(
          ENTITY_NAMES.QUESTION ?? 'CÃ¢u há»i',
          id,
        ),
      );
    }

    return chain;
  }

  private async getAnswerChainsForQuestions(
    questionIds: string[],
  ): Promise<AnswerEntity[][]> {
    if (questionIds.length === 0) {
      return [];
    }

    const answers = await this.answerRepo.find({
      where: questionIds.map((questionId) => ({ questionId })),
    });
    const answersById = new Map(answers.map((answer) => [answer.id, answer]));
    const nextContentTargets = new Set(
      answers
        .map((answer) => answer.nextContent)
        .filter((nextContent): nextContent is string => !!nextContent),
    );
    const rootAnswers = answers.filter((answer) => !nextContentTargets.has(answer.id));

    return rootAnswers.map((rootAnswer) => {
      const chain: AnswerEntity[] = [];
      const visited = new Set<string>();
      let current: AnswerEntity | undefined = rootAnswer;

      while (current && !visited.has(current.id)) {
        chain.push(current);
        visited.add(current.id);
        current = current.nextContent
          ? answersById.get(current.nextContent)
          : undefined;
      }

      return chain;
    });
  }

  private async deleteImagesFromQuestions(
    questions: QuestionEntity[],
  ): Promise<void> {
    for (const question of questions) {
      await this.deleteImageIfNeeded(question.contentType, question.content);
    }
  }

  private async deleteImagesFromAnswers(answers: AnswerEntity[]): Promise<void> {
    for (const answer of answers) {
      await this.deleteImageIfNeeded(answer.contentType, answer.content);
    }
  }

  private async deleteImageIfNeeded(
    contentType: ContentTypes,
    content: string,
  ): Promise<void> {
    if (contentType !== ContentTypes.IMAGE || !content) {
      return;
    }

    await this.uploadService.deleteFileByPath(content);
  }
}
