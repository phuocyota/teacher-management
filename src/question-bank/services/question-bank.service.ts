import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Not, Repository } from 'typeorm';
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
import {
  QuestionBankDetailResponseDto,
  QuestionBankResponseDto,
} from '../dto/question-bank.dto';
import { autoMapListToDto } from 'src/common/utils/auto-map.util';
import {
  ImportExamResultDto,
  ImportZipExamResultDto,
} from '../dto/import-exam.dto';
import { QuestionBankQuestionEntity } from 'src/question-bank-question/question-bank-question.entity';
import { QuestionBankSectionEntity } from 'src/question-bank-section/question-bank-section.entity';
import { QuestionBankImportService } from './question-bank-import.service';
import { QuestionService } from 'src/question/question.service';
import { QuestionEntity } from 'src/question/question.entity';
import { AnswerEntity } from 'src/answer/answer.entity';
import { ExamSetEntity } from 'src/exam-set/exam-set.entity';
import { ExamSetQuestionBankEntity } from 'src/exam-set-question-bank/exam-set-question-bank.entity';
import { runInTransaction } from 'src/common/database/transaction.utils';
import { QuestionBankZipImportService } from './question-bank-zip-import.service';
import { UploadService } from 'src/upload/upload.service';
import { ContentTypes } from 'src/common/enum/content-type.enum';

interface QuestionBankResourceCleanup {
  filePaths: string[];
}

@Injectable()
export class QuestionBankService {
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
    private readonly questionBankZipImportService: QuestionBankZipImportService,
    @Inject(forwardRef(() => QuestionService))
    private readonly questionService: QuestionService,
    private readonly uploadService: UploadService,
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
    return this.findRandomQuestionWithoutDuplicate(
      questionBankId,
      excludeQuestionIds,
    );
  }

  async findQuestions(id: string): Promise<QuestionBankDetailResponseDto> {
    const questionBank = await this.findOne(id);
    const links = await this.questionBankQuestionRepo.find({
      where: { questionBankId: id },
      relations: ['question', 'section'],
      order: { orderNo: 'ASC' },
    });
    const sections = await this.entityManager
      .getRepository(QuestionBankSectionEntity)
      .find({
        where: { questionBankId: id },
        order: { orderNo: 'ASC' },
      });
    const questionIds = links
      .map((item) => item.questionId)
      .filter((questionId): questionId is string => Boolean(questionId));
    const answers = questionIds.length
      ? await this.answerRepo.find({
          where: { questionId: In(questionIds) },
          order: { orderNo: 'ASC', createdAt: 'ASC' },
        })
      : [];
    const answersByQuestionId = answers.reduce<Map<string, AnswerEntity[]>>(
      (map, answer) => {
        const items = map.get(answer.questionId) ?? [];
        items.push(answer);
        map.set(answer.questionId, items);
        return map;
      },
      new Map(),
    );

    const questions = links
      .filter((item) => Boolean(item.question))
      .map((item) => ({
        id: item.question.id,
        questionBankId: item.questionBankId,
        sectionId: item.sectionId ?? null,
        content: item.question.content,
        contentType: item.question.contentType,
        orderNo: item.orderNo,
        point: item.points,
        type: item.question.type,
        answers: (answersByQuestionId.get(item.questionId) ?? []).map(
          (answer) => ({
            id: answer.id,
            questionId: answer.questionId,
            content: answer.content,
            contentType: answer.contentType,
            isCorrect: answer.isCorrect ?? null,
          }),
        ),
      }));

    return {
      id: questionBank.id,
      code: questionBank.code,
      name: questionBank.name,
      questions,
      sections: sections.map((section) => ({
        id: section.id,
        title: section.title,
        instruction: section.instruction ?? null,
        orderNo: section.orderNo,
        meta: section.meta ?? null,
        questions: questions.filter(
          (question) => question.sectionId === section.id,
        ),
      })),
    };
  }

  private async findRandomQuestionWithoutDuplicate(
    questionBankId: string,
    excludeQuestionIds: string[] = [],
  ): Promise<QuestionEntity> {
    await this.findOne(questionBankId);
    const skippedQuestionIds = [...new Set(excludeQuestionIds)];

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

    if (dto.sectionId) {
      const section = await this.entityManager
        .getRepository(QuestionBankSectionEntity)
        .findOne({ where: { id: dto.sectionId } });

      if (!section || section.questionBankId !== questionBankId) {
        throw new BadRequestException(
          'Phần đề thi không thuộc ngân hàng câu hỏi đã chọn',
        );
      }
    }

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
      sectionId: dto.sectionId ?? null,
      orderNo: dto.orderNo ?? totalInBank + 1,
      points: dto.points ?? 1,
    });

    return this.questionBankQuestionRepo.save(record);
  }

  async remove(id: string): Promise<void> {
    const record = await this.findOne(id);
    await this.removeLinkedQuestions(id);

    await this.questionBankRepo.remove(record);
  }

  async removeResource(id: string): Promise<void> {
    const cleanup = await runInTransaction(
      this.entityManager,
      async (manager) => this.removeResourcesInTransaction(id, manager),
    );

    await Promise.allSettled(
      [...new Set(cleanup.filePaths)].map((path) =>
        this.uploadService.deleteFileByPath(path),
      ),
    );
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

  async importExamFromZip(
    questionBankId: string,
    zipBuffer: Buffer,
  ): Promise<ImportZipExamResultDto> {
    return this.questionBankZipImportService.importExamFromZip(
      questionBankId,
      zipBuffer,
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

  private async removeResourcesInTransaction(
    questionBankId: string,
    manager: EntityManager,
  ): Promise<QuestionBankResourceCleanup> {
    const questionBankRepo = manager.getRepository(QuestionBankEntity);
    const linkRepo = manager.getRepository(QuestionBankQuestionEntity);
    const sectionRepo = manager.getRepository(QuestionBankSectionEntity);
    const questionRepo = manager.getRepository(QuestionEntity);
    const answerRepo = manager.getRepository(AnswerEntity);
    const record = await questionBankRepo.findOne({
      where: { id: questionBankId },
      lock: { mode: 'pessimistic_write' },
    });

    if (!record) {
      throw new NotFoundException(
        ERROR_MESSAGES.NOT_FOUND_WITH_ID(
          ENTITY_NAMES.QUESTION_BANK,
          questionBankId,
        ),
      );
    }

    const [links, sections] = await Promise.all([
      linkRepo.find({ where: { questionBankId } }),
      sectionRepo.find({ where: { questionBankId } }),
    ]);
    const filePaths = sections
      .map((section) => {
        const audio = section.meta?.audio as { path?: unknown } | undefined;
        return typeof audio?.path === 'string' ? audio.path : null;
      })
      .filter((path): path is string => Boolean(path));
    const deletableQuestionIds: string[] = [];

    for (const rootQuestionId of [
      ...new Set(links.map((link) => link.questionId)),
    ]) {
      const chainIds = await this.collectQuestionChainIds(
        questionRepo,
        rootQuestionId,
      );
      const externalReferences = await linkRepo.count({
        where: {
          questionId: In(chainIds),
          questionBankId: Not(questionBankId),
        },
      });

      if (externalReferences === 0) {
        deletableQuestionIds.push(...chainIds);
      }
    }

    const uniqueQuestionIds = [...new Set(deletableQuestionIds)];
    if (uniqueQuestionIds.length > 0) {
      const [questions, answers] = await Promise.all([
        questionRepo.find({ where: { id: In(uniqueQuestionIds) } }),
        answerRepo.find({ where: { questionId: In(uniqueQuestionIds) } }),
      ]);
      filePaths.push(
        ...questions
          .filter((question) => question.contentType === ContentTypes.IMAGE)
          .map((question) => question.content),
        ...answers
          .filter((answer) => answer.contentType === ContentTypes.IMAGE)
          .map((answer) => answer.content),
      );
    }

    await linkRepo.delete({ questionBankId });
    await sectionRepo.delete({ questionBankId });
    if (uniqueQuestionIds.length > 0) {
      await questionRepo.delete({ id: In(uniqueQuestionIds) });
    }

    record.totalQuestions = 0;
    await questionBankRepo.save(record);

    return { filePaths };
  }

  private async collectQuestionChainIds(
    questionRepo: Repository<QuestionEntity>,
    rootQuestionId: string,
  ): Promise<string[]> {
    const ids: string[] = [];
    const visited = new Set<string>();
    let currentId: string | undefined = rootQuestionId;

    while (currentId && !visited.has(currentId)) {
      const question = await questionRepo.findOne({
        where: { id: currentId },
      });
      if (!question) {
        break;
      }

      ids.push(question.id);
      visited.add(question.id);
      currentId = question.nextContent;
    }

    return ids;
  }
}
