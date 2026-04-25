import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
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
import { ExamSetEntity } from 'src/exam-set/exam-set.entity';
import { ExamSetQuestionBankEntity } from 'src/exam-set-question-bank/exam-set-question-bank.entity';
import { runInTransaction } from 'src/common/database/transaction.utils';

@Injectable()
export class QuestionBankService {
  constructor(
    @InjectRepository(QuestionBankEntity)
    private readonly questionBankRepo: Repository<QuestionBankEntity>,
    @InjectRepository(QuestionBankQuestionEntity)
    private readonly questionBankQuestionRepo: Repository<QuestionBankQuestionEntity>,
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
        totalScore: dto.totalScore,
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

    return {
      data: autoMapListToDto(QuestionBankResponseDto, data),
      page,
      size,
      total,
    };
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

    if (dto.totalScore !== undefined) {
      record.totalScore = dto.totalScore;
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
        await this.replaceQuestionBankExamSets(savedRecord.id, examSets, manager);
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
    const linkedQuestions = await this.questionBankQuestionRepo.find({
      where: { questionBankId: id },
      select: ['questionId'],
    });
    const uniqueQuestionIds = Array.from(
      new Set(linkedQuestions.map((item) => item.questionId)),
    );

    for (const questionId of uniqueQuestionIds) {
      await this.questionService.remove(questionId);
    }

    await this.questionBankRepo.remove(record);
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
}
