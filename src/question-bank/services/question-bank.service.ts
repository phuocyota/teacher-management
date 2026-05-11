import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { promises as fs } from 'fs';
import { dirname, join } from 'path';
import { EntityManager, In, Repository } from 'typeorm';
import { QuestionBankEntity } from '../question-bank.entity';
import {
  CreateQuestionBankDto,
  QuestionBankExamSetDto,
  UpdateQuestionBankDto,
} from '../dto/create-question-bank.dto';
import { AddQuestionToQuestionBankDto } from '../dto/add-question-to-question-bank.dto';
import { ClassService } from 'src/class/class.service';
import {
  ERROR_MESSAGES,
  ENTITY_NAMES,
} from 'src/common/constant/error-messages.constant';
import { PaginationResponseDto } from 'src/common/dto/pagination.dto';
import { QuestionBankResponseDto } from '../dto/question-bank.dto';
import { autoMapListToDto } from 'src/common/utils/auto-map.util';
import { ImportExamResultDto } from '../dto/import-exam.dto';
import { QuestionBankQuestionEntity } from 'src/question-bank-question/question-bank-question.entity';
import { QuestionBankImportService } from './question-bank-import.service';
import { QuestionService } from 'src/question/question.service';
import { QuestionEntity } from 'src/question/question.entity';
import { AnswerEntity } from 'src/answer/answer.entity';
import { ExamSetEntity } from 'src/exam-set/exam-set.entity';
import { ExamSetQuestionBankEntity } from 'src/exam-set-question-bank/exam-set-question-bank.entity';
import { runInTransaction } from 'src/common/database/transaction.utils';

type RandomQuestionHistory = Record<string, string[]>;

@Injectable()
export class QuestionBankService {
  private readonly randomHistoryFilePath = join(
    process.cwd(),
    'data',
    'question-bank-random-history.json',
  );
  private randomHistoryQueue: Promise<void> = Promise.resolve();

  constructor(
    @InjectRepository(QuestionBankEntity)
    private readonly questionBankRepo: Repository<QuestionBankEntity>,
    @InjectRepository(QuestionBankQuestionEntity)
    private readonly questionBankQuestionRepo: Repository<QuestionBankQuestionEntity>,
    @InjectRepository(QuestionEntity)
    private readonly questionRepo: Repository<QuestionEntity>,
    @InjectRepository(AnswerEntity)
    private readonly answerRepo: Repository<AnswerEntity>,
    @InjectRepository(ExamSetEntity)
    private readonly examSetRepo: Repository<ExamSetEntity>,
    private readonly entityManager: EntityManager,
    private readonly classService: ClassService,
    private readonly questionBankImportService: QuestionBankImportService,
    @Inject(forwardRef(() => QuestionService))
    private readonly questionService: QuestionService,
  ) {}

  async create(dto: CreateQuestionBankDto): Promise<QuestionBankEntity> {
    await this.classService.findOne(dto.classId);
    const examSets = await this.resolveValidatedExamSets(dto.examSets);

    return runInTransaction(this.entityManager, async (manager) => {
      const questionBankRepo = manager.getRepository(QuestionBankEntity);
      const record = questionBankRepo.create({
        code: dto.code,
        name: dto.name,
        totalQuestions: dto.totalQuestions,
        timeLimit: dto.timeLimit,
        maxAttempts: dto.maxAttempts,
        totalMarks: dto.totalMarks,
        examDate: dto.examDate,
        classId: dto.classId,
        image: dto.image,
      });
      const savedRecord = await questionBankRepo.save(record);

      await this.replaceQuestionBankExamSets(savedRecord.id, examSets, manager);

      return savedRecord;
    });
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
      qb.andWhere('qb.classId = :classId', { classId });
    }

    if (examDate) {
      qb.andWhere('qb.exam_date = :examDate', { examDate });
    }

    qb.orderBy('qb.examDate', 'DESC');
    qb.skip(skip).take(size);

    const [data, total] = await qb.getManyAndCount();
    const examSetIdMap = await this.getPrimaryExamSetIdByQuestionBankIds(
      data.map((item) => item.id),
    );

    return {
      data: autoMapListToDto(QuestionBankResponseDto, data).map((item) => ({
        ...item,
        examSetId: examSetIdMap.get(item.id) ?? null,
      })),
      page,
      size,
      total,
    };
  }

  private async getPrimaryExamSetIdByQuestionBankIds(
    questionBankIds: string[],
  ): Promise<Map<string, string>> {
    if (questionBankIds.length === 0) {
      return new Map();
    }

    const links = await this.entityManager
      .getRepository(ExamSetQuestionBankEntity)
      .find({
        where: { questionBankId: In(questionBankIds) },
        order: { order: 'ASC', createdAt: 'ASC' },
      });

    const examSetIdByQuestionBankId = new Map<string, string>();
    for (const link of links) {
      if (!examSetIdByQuestionBankId.has(link.questionBankId)) {
        examSetIdByQuestionBankId.set(link.questionBankId, link.examSetId);
      }
    }

    return examSetIdByQuestionBankId;
  }

  async getMaxCode(): Promise<number> {
    const result = await this.questionBankRepo
      .createQueryBuilder('qb')
      .select(
        "MAX(CASE WHEN regexp_replace(qb.code, '\\D', '', 'g') = '' THEN 0 ELSE (regexp_replace(qb.code, '\\D', '', 'g'))::int END)",
        'maxCode',
      )
      .getRawOne<{ maxCode: number | null }>();

    if (!result || result.maxCode === null || result.maxCode === undefined) {
      return 0;
    }

    return Number(result.maxCode) || 0;
  }

  async findRandomQuestion(
    questionBankId: string,
    excludeQuestionIds: string[] = [],
  ): Promise<QuestionEntity> {
    return this.withRandomHistoryLock(() =>
      this.findRandomQuestionWithoutDuplicate(
        questionBankId,
        excludeQuestionIds,
      ),
    );
  }

  private async findRandomQuestionWithoutDuplicate(
    questionBankId: string,
    excludeQuestionIds: string[] = [],
  ): Promise<QuestionEntity> {
    await this.findOne(questionBankId);
    const history = await this.readRandomQuestionHistory();
    const usedQuestionIds = history[questionBankId] ?? [];
    const skippedQuestionIds = [
      ...new Set([...excludeQuestionIds, ...usedQuestionIds]),
    ];

    const qb = this.questionRepo
      .createQueryBuilder('question')
      .innerJoin(
        QuestionBankQuestionEntity,
        'qbq',
        'qbq.question_id = question.id AND qbq.question_bank_id = :questionBankId',
        { questionBankId },
      )
      .where('question.isRoot = :isRoot', { isRoot: true });

    if (skippedQuestionIds.length > 0) {
      qb.andWhere('question.id NOT IN (:...excludeQuestionIds)', {
        excludeQuestionIds: skippedQuestionIds,
      });
    }

    const question = await qb.orderBy('RANDOM()').limit(1).getOne();

    if (!question) {
      throw new NotFoundException(
        'Khong con cau hoi nao phu hop trong ngan hang cau hoi nay',
      );
    }

    (question as any).questionBankId = questionBankId;
    await this.saveRandomQuestionHistory({
      ...history,
      [questionBankId]: [...new Set([...usedQuestionIds, question.id])],
    });

    question.answers = await this.getAnswersWithDetails(question.id);

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
  }

  private async withRandomHistoryLock<T>(task: () => Promise<T>): Promise<T> {
    const runTask = this.randomHistoryQueue.then(task, task);
    this.randomHistoryQueue = runTask.then(
      () => undefined,
      () => undefined,
    );
    return runTask;
  }

  private async readRandomQuestionHistory(): Promise<RandomQuestionHistory> {
    try {
      const content = await fs.readFile(this.randomHistoryFilePath, 'utf8');
      const parsed = JSON.parse(content) as unknown;

      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return {};
      }

      return Object.entries(parsed).reduce<RandomQuestionHistory>(
        (history, [questionBankId, questionIds]) => {
          if (Array.isArray(questionIds)) {
            history[questionBankId] = questionIds.filter(
              (questionId): questionId is string =>
                typeof questionId === 'string',
            );
          }
          return history;
        },
        {},
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return {};
      }
      throw error;
    }
  }

  private async saveRandomQuestionHistory(
    history: RandomQuestionHistory,
  ): Promise<void> {
    await fs.mkdir(dirname(this.randomHistoryFilePath), { recursive: true });
    const tmpFilePath = `${this.randomHistoryFilePath}.tmp`;
    await fs.writeFile(tmpFilePath, JSON.stringify(history, null, 2), 'utf8');
    await fs.rename(tmpFilePath, this.randomHistoryFilePath);
  }

  private async clearRandomQuestionHistory(
    questionBankId: string,
  ): Promise<void> {
    await this.withRandomHistoryLock(async () => {
      const history = await this.readRandomQuestionHistory();
      if (!history[questionBankId]) {
        return;
      }

      delete history[questionBankId];
      await this.saveRandomQuestionHistory(history);
    });
  }

  private async getAnswersWithDetails(
    questionId: string,
  ): Promise<AnswerEntity[]> {
    const answers = await this.answerRepo.find({
      where: { questionId },
      order: { orderNo: 'ASC', createdAt: 'ASC' },
    });

    return Promise.all(
      answers.map(async (answer) => {
        if (!answer.nextContent) {
          return answer;
        }

        const nextContentEntity = await this.answerRepo.findOne({
          where: { id: answer.nextContent },
          select: ['id', 'content', 'contentType', 'meta'],
        });

        if (nextContentEntity) {
          (answer as any).nextContentDetails = {
            id: nextContentEntity.id,
            content: nextContentEntity.content,
            contentType: nextContentEntity.contentType,
            meta: nextContentEntity.meta,
          };
        }

        return answer;
      }),
    );
  }

  async findOne(id: string): Promise<QuestionBankEntity> {
    const record = await this.questionBankRepo.findOne({
      where: { id },
      relations: ['class'],
    });
    if (!record) {
      throw new NotFoundException(
        ERROR_MESSAGES.NOT_FOUND_WITH_ID(ENTITY_NAMES.QUESTION_BANK, id),
      );
    }
    return record;
  }

  async update(
    id: string,
    dto: UpdateQuestionBankDto,
  ): Promise<QuestionBankEntity> {
    const record = await this.findOne(id);
    const examSets =
      dto.examSets !== undefined
        ? await this.resolveValidatedExamSets(dto.examSets)
        : undefined;

    if (dto.classId !== undefined) {
      const cls = await this.classService.findOne(dto.classId);
      record.class = cls;
      record.classId = cls.id;
    }

    if (dto.name !== undefined) {
      record.name = dto.name;
    }

    if (dto.code !== undefined) {
      record.code = dto.code;
    }

    if (dto.totalQuestions !== undefined) {
      record.totalQuestions = dto.totalQuestions;
    }

    if (dto.timeLimit !== undefined) {
      record.timeLimit = dto.timeLimit;
    }

    if (dto.maxAttempts !== undefined) {
      record.maxAttempts = dto.maxAttempts;
    }

    if (dto.totalMarks !== undefined) {
      record.totalMarks = dto.totalMarks;
    }

    if (dto.examDate !== undefined) {
      record.examDate = dto.examDate;
    }

    if (dto.image !== undefined) {
      record.image = dto.image;
    }

    return runInTransaction(this.entityManager, async (manager) => {
      const questionBankRepo = manager.getRepository(QuestionBankEntity);
      const savedRecord = await questionBankRepo.save(record);

      if (examSets !== undefined) {
        await this.replaceQuestionBankExamSets(
          savedRecord.id,
          examSets,
          manager,
        );
      }

      return savedRecord;
    });
  }

  async addQuestion(
    questionBankId: string,
    dto: AddQuestionToQuestionBankDto,
  ): Promise<QuestionBankQuestionEntity> {
    await this.findOne(questionBankId);
    await this.questionService.findOne(dto.questionId);

    const existed = await this.questionBankQuestionRepo.findOne({
      where: {
        questionBankId,
        questionId: dto.questionId,
      },
    });

    if (existed) {
      throw new BadRequestException(
        'Cau hoi da ton tai trong ngan hang cau hoi',
      );
    }

    const totalInBank = await this.questionBankQuestionRepo.count({
      where: { questionBankId },
    });

    const record = this.questionBankQuestionRepo.create({
      questionBankId,
      questionId: dto.questionId,
      orderNo: dto.orderNo ?? totalInBank + 1,
      points: dto.points ?? 1,
    });

    return this.questionBankQuestionRepo.save(record);
  }

  async remove(id: string): Promise<void> {
    const record = await this.findOne(id);
    await this.removeLinkedQuestions(id);
    await this.clearRandomQuestionHistory(id);

    await this.questionBankRepo.remove(record);
  }

  async removeResource(id: string): Promise<void> {
    const record = await this.findOne(id);
    await this.removeLinkedQuestions(id);
    await this.clearRandomQuestionHistory(id);

    record.totalQuestions = 0;
    await this.questionBankRepo.save(record);
  }

  async importExamFromPdf(
    questionBankId: string,
    pdfBuffer: Buffer,
  ): Promise<ImportExamResultDto> {
    return this.questionBankImportService.importExamFromPdf(
      questionBankId,
      pdfBuffer,
    );
  }

  private async resolveValidatedExamSets(
    examSets?: QuestionBankExamSetDto[],
  ): Promise<QuestionBankExamSetDto[]> {
    if (!examSets || examSets.length === 0) {
      return [];
    }

    const uniqueExamSetIds = Array.from(
      new Set(examSets.map((item) => item.examSetId)),
    );

    if (uniqueExamSetIds.length !== examSets.length) {
      throw new BadRequestException(
        'examSets khong duoc chua examSetId trung lap',
      );
    }

    const invalidOrder = examSets.find(
      (item) => !Number.isInteger(item.order) || item.order < 1,
    );
    if (invalidOrder) {
      throw new BadRequestException('examSets.order phai la so nguyen >= 1');
    }

    const existedExamSets = await this.examSetRepo.find({
      where: { id: In(uniqueExamSetIds) },
    });
    const existedExamSetIds = new Set(existedExamSets.map((item) => item.id));
    const missingExamSetId = uniqueExamSetIds.find(
      (examSetId) => !existedExamSetIds.has(examSetId),
    );

    if (missingExamSetId) {
      throw new NotFoundException(
        ERROR_MESSAGES.NOT_FOUND_WITH_ID(
          ENTITY_NAMES.EXAM_SET,
          missingExamSetId,
        ),
      );
    }

    return examSets.map((item) => ({
      examSetId: item.examSetId,
      order: item.order,
    }));
  }

  private async replaceQuestionBankExamSets(
    questionBankId: string,
    examSets: QuestionBankExamSetDto[],
    manager: EntityManager,
  ): Promise<void> {
    const examSetQuestionBankRepo = manager.getRepository(
      ExamSetQuestionBankEntity,
    );

    await examSetQuestionBankRepo.delete({ questionBankId });

    if (examSets.length === 0) {
      return;
    }

    const entities = examSets.map((item) =>
      examSetQuestionBankRepo.create({
        examSetId: item.examSetId,
        questionBankId,
        order: item.order,
      }),
    );

    await examSetQuestionBankRepo.save(entities);
  }

  private async removeLinkedQuestions(questionBankId: string): Promise<void> {
    const linkedQuestions = await this.questionBankQuestionRepo.find({
      where: { questionBankId },
      select: ['questionId'],
    });
    const uniqueQuestionIds = Array.from(
      new Set(linkedQuestions.map((item) => item.questionId)),
    );

    for (const questionId of uniqueQuestionIds) {
      await this.questionService.remove(questionId);
    }
  }
}
