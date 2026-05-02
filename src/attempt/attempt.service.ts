import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AttemptEntity } from './attempt.entity';
import { StudentService } from 'src/student/student.service';
import { StudentEntity } from 'src/student/student.entity';
import { QuestionBankService } from 'src/question-bank/services/question-bank.service';
import {
  ENTITY_NAMES,
  ERROR_MESSAGES,
} from 'src/common/constant/error-messages.constant';
import { PaginationResponseDto } from 'src/common/dto/pagination.dto';
import { autoMapListToDto, autoMapToDto } from 'src/common/utils/auto-map.util';
import {
  AttemptExamHistoryItemDto,
  AttemptResponseDto,
} from './dto/attempt.dto';
import { AttemptStatus } from './enum/attempt-status.enum';
import { CreateAttemptDto, UpdateAttemptDto } from './dto/create-attempt.dto';
import { ExamSetService } from 'src/exam-set/exam-set.service';
import { JwtPayload } from 'src/common/interface/jwt-payload.interface';
import { UserType } from 'src/common/enum/user-type.enum';
import { UserEntity } from 'src/user/user.entity';
import { QuestionBankQuestionEntity } from 'src/question-bank-question/question-bank-question.entity';
import { QuestionEntity } from 'src/question/question.entity';
import { AnswerEntity } from 'src/answer/answer.entity';
import { StudentAnswerEntity } from 'src/student-answer/student-answer.entity';
import { ExamSetQuestionBankService } from 'src/exam-set-question-bank/exam-set-question-bank.service';
import { StudentGroupEntity } from 'src/student-group/student-group.entity';
import { SchoolEntity } from 'src/school/school.entity';
import { QuestionType } from 'src/question/enum/question-type.enum';
import { QuestionBankQuestionPayloadService } from 'src/question-bank/services/question-bank-question-payload.service';
import {
  AttemptAnswerChainItemDto,
  AttemptAnswerOptionDto,
  AttemptQuestionChainItemDto,
  AttemptQuestionItemDto,
  AttemptReviewAnswerOptionDto,
  AttemptReviewQuestionItemDto,
  AttemptReviewResponseDto,
  EndAttemptAnswerDto,
  EndAttemptDto,
  EndAttemptResponseDto,
  StartAttemptDto,
  StartAttemptResponseDto,
} from './dto/attempt-session.dto';

@Injectable()
export class AttemptService {
  constructor(
    @InjectRepository(AttemptEntity)
    private readonly attemptRepo: Repository<AttemptEntity>,
    @InjectRepository(StudentEntity)
    private readonly studentRepo: Repository<StudentEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(StudentGroupEntity)
    private readonly studentGroupRepo: Repository<StudentGroupEntity>,
    @InjectRepository(SchoolEntity)
    private readonly schoolRepo: Repository<SchoolEntity>,
    @InjectRepository(QuestionBankQuestionEntity)
    private readonly questionBankQuestionRepo: Repository<QuestionBankQuestionEntity>,
    @InjectRepository(QuestionEntity)
    private readonly questionRepo: Repository<QuestionEntity>,
    @InjectRepository(AnswerEntity)
    private readonly answerRepo: Repository<AnswerEntity>,
    @InjectRepository(StudentAnswerEntity)
    private readonly studentAnswerRepo: Repository<StudentAnswerEntity>,
    private readonly studentService: StudentService,
    private readonly questionBankService: QuestionBankService,
    private readonly questionBankQuestionPayloadService: QuestionBankQuestionPayloadService,
    private readonly examSetService: ExamSetService,
    private readonly examSetQuestionBankService: ExamSetQuestionBankService,
  ) {}

  async create(dto: CreateAttemptDto): Promise<AttemptEntity> {
    await this.studentService.findOne(dto.studentId);
    await this.questionBankService.findOne(dto.questionBankId);
    await this.examSetService.findOne(dto.examSetId);

    const record = this.attemptRepo.create({
      studentId: dto.studentId,
      questionBankId: dto.questionBankId,
      examSetId: dto.examSetId,
      status: dto.status ?? AttemptStatus.DOING,
      startedAt: new Date(dto.startedAt),
      submittedAt: dto.submittedAt ? new Date(dto.submittedAt) : undefined,
      score: dto.score,
    });

    return this.attemptRepo.save(record);
  }

  async start(
    dto: StartAttemptDto,
    user: JwtPayload,
  ): Promise<StartAttemptResponseDto> {
    if (!user?.userId) {
      throw new ForbiddenException(ERROR_MESSAGES.INVALID_TOKEN_STRUCTURE);
    }

    await this.questionBankService.findOne(dto.questionBankId);
    await this.examSetService.findOne(dto.examSetId);
    await this.validateExamSetQuestionBank(dto.examSetId, dto.questionBankId);
    await this.ensureStudentProfile(user.userId);

    const record = this.attemptRepo.create({
      studentId: user.userId,
      questionBankId: dto.questionBankId,
      examSetId: dto.examSetId,
      status: AttemptStatus.DOING,
      startedAt: new Date(),
    });

    const savedAttempt = await this.attemptRepo.save(record);
    const questions = await this.getExamQuestions(dto.questionBankId);

    return {
      attemptId: savedAttempt.id,
      status: savedAttempt.status,
      startedAt: savedAttempt.startedAt,
      studentId: savedAttempt.studentId,
      questionBankId: savedAttempt.questionBankId,
      examSetId: savedAttempt.examSetId,
      questions,
    };
  }

  async end(
    id: string,
    dto: EndAttemptDto,
    user: JwtPayload,
  ): Promise<EndAttemptResponseDto> {
    if (!user?.userId) {
      throw new ForbiddenException(ERROR_MESSAGES.INVALID_TOKEN_STRUCTURE);
    }

    const attempt = await this.attemptRepo.findOne({
      where: { id, studentId: user.userId, status: AttemptStatus.DOING },
      relations: ['student', 'questionBank', 'examSet'],
    });

    if (!attempt) {
      throw new ForbiddenException(ERROR_MESSAGES.NO_PERMISSION_SUBMIT_ATTEMPT);
    }

    const questionLinks = await this.questionBankQuestionRepo.find({
      where: { questionBankId: attempt.questionBankId },
      order: { orderNo: 'ASC' },
    });
    const submittedAnswers = await this.normalizeSubmittedAnswers(
      dto.answers,
      questionLinks,
    );
    const allowedQuestionIds = new Set(
      questionLinks.map((item) => item.questionId),
    );

    if (
      submittedAnswers.some((item) => !allowedQuestionIds.has(item.questionId))
    ) {
      throw new BadRequestException(
        ERROR_MESSAGES.ATTEMPT_INVALID_QUESTION_IN_SUBMISSION,
      );
    }

    await this.studentAnswerRepo.delete({ attemptId: attempt.id });

    let totalScore = 0;

    if (dto.answers.length > 0) {
      const submittedQuestionIds = [
        ...new Set(submittedAnswers.map((item) => item.questionId)),
      ];

      const answerEntities = submittedQuestionIds.length
        ? await this.answerRepo.find({
            where: { questionId: In(submittedQuestionIds) },
          })
        : [];
      const questionEntities = submittedQuestionIds.length
        ? await this.questionRepo.find({
            where: { id: In(submittedQuestionIds) },
          })
        : [];
      const answerMap = new Map(answerEntities.map((item) => [item.id, item]));
      const questionTypeById = new Map(
        questionEntities.map((item) => [item.id, item.type]),
      );
      const pointsByQuestionId = new Map(
        questionLinks.map((item) => [item.questionId, item.points]),
      );
      const correctAnswerIdsByQuestionId = new Map<string, string[]>();

      for (const answer of answerEntities) {
        if (!answer.isCorrect) {
          continue;
        }

        const existingIds =
          correctAnswerIdsByQuestionId.get(answer.questionId) ?? [];
        existingIds.push(answer.id);
        correctAnswerIdsByQuestionId.set(answer.questionId, existingIds);
      }

      for (const submitted of submittedAnswers) {
        const questionType =
          questionTypeById.get(submitted.questionId) ??
          QuestionType.SINGLE_CHOICE;
        this.validateSubmittedAnswerByQuestionType(submitted, questionType);

        if (submitted.answerId) {
          const answer = answerMap.get(submitted.answerId);
          if (!answer || answer.questionId !== submitted.questionId) {
            throw new BadRequestException(
              ERROR_MESSAGES.ATTEMPT_INVALID_ANSWER_MAPPING,
            );
          }
        }

        for (const selectedId of submitted.selectedAnswerIds ?? []) {
          const answer = answerMap.get(selectedId);
          if (!answer || answer.questionId !== submitted.questionId) {
            throw new BadRequestException(
              ERROR_MESSAGES.ATTEMPT_INVALID_SELECTED_ANSWER_MAPPING,
            );
          }
        }
      }

      const records = submittedAnswers.map((submitted) => {
        const questionType =
          questionTypeById.get(submitted.questionId) ??
          QuestionType.SINGLE_CHOICE;
        const selectedIds = [
          ...(submitted.answerId ? [submitted.answerId] : []),
          ...(submitted.selectedAnswerIds ?? []),
        ];
        const normalizedSelectedIds = [...new Set(selectedIds)].sort();
        const correctIds = [
          ...(correctAnswerIdsByQuestionId.get(submitted.questionId) ?? []),
        ].sort();
        const isCorrect =
          questionType === QuestionType.TEXT_INPUT ||
          questionType === QuestionType.MATCHING ||
          questionType === QuestionType.ORDERING
            ? undefined
            : correctIds.length > 0 &&
              normalizedSelectedIds.length === correctIds.length &&
              normalizedSelectedIds.every(
                (item, index) => item === correctIds[index],
              );
        const pointsEarned =
          isCorrect === true
            ? (pointsByQuestionId.get(submitted.questionId) ?? 0)
            : 0;

        totalScore += pointsEarned;

        return this.studentAnswerRepo.create({
          attemptId: attempt.id,
          questionId: submitted.questionId,
          answerId: submitted.answerId,
          description: submitted.description,
          textValue: submitted.textValue,
          selectedAnswerIds: submitted.selectedAnswerIds,
          timeSpentSec: submitted.timeSpentSec,
          isCorrect,
          pointsEarned,
        });
      });
      await this.studentAnswerRepo.save(records);
    }

    attempt.status = AttemptStatus.SUBMITTED;
    attempt.submittedAt = new Date();
    attempt.score = totalScore;
    const savedAttempt = await this.attemptRepo.save(attempt);

    return {
      attemptId: savedAttempt.id,
      status: savedAttempt.status,
      submittedAt: savedAttempt.submittedAt!,
      score: savedAttempt.score ?? null,
      totalQuestions: questionLinks.length,
      answeredQuestions: submittedAnswers.length,
    };
  }

  async findAll(
    user: JwtPayload,
    page = 1,
    size = 10,
    questionBankId?: string,
    examSetId?: string,
    status?: AttemptStatus,
  ): Promise<PaginationResponseDto<AttemptResponseDto>> {
    const skip = (page - 1) * size;

    if (!user?.userId) {
      throw new ForbiddenException(ERROR_MESSAGES.INVALID_TOKEN_STRUCTURE);
    }

    if ((questionBankId && !examSetId) || (!questionBankId && examSetId)) {
      throw new BadRequestException(
        'questionBankId and examSetId must be provided together',
      );
    }

    const qb = this.attemptRepo
      .createQueryBuilder('attempt')
      .leftJoinAndSelect('attempt.student', 'student')
      .leftJoinAndSelect('attempt.questionBank', 'questionBank')
      .leftJoinAndSelect('attempt.examSet', 'examSet');

    qb.andWhere('student.id = :userId', {
      userId: user.userId,
    });

    if (questionBankId) {
      qb.andWhere('attempt.questionBankId = :questionBankId', {
        questionBankId,
      });
    }

    if (examSetId) {
      qb.andWhere('attempt.examSetId = :examSetId', { examSetId });
    }

    if (status) {
      qb.andWhere('attempt.status = :status', { status });
    }

    qb.orderBy('attempt.startedAt', 'DESC');
    qb.skip(skip).take(size);

    const [data, total] = await qb.getManyAndCount();

    const mappedData = data.map((attempt) => {
      const dto = autoMapToDto(AttemptResponseDto, attempt);
      // Add fullScore from questionBank
      if (attempt.questionBank?.totalScore) {
        dto.fullScore = attempt.questionBank.totalScore;
      }
      return dto;
    });

    return {
      data: mappedData,
      page,
      size,
      total,
    };
  }

  async review(
    id: string,
    user: JwtPayload,
  ): Promise<AttemptReviewResponseDto> {
    if (!user?.userId) {
      throw new ForbiddenException(ERROR_MESSAGES.INVALID_TOKEN_STRUCTURE);
    }

    const attempt = await this.attemptRepo.findOne({
      where: {
        id,
        studentId: user.userId,
      },
    });

    if (!attempt) {
      throw new ForbiddenException(ERROR_MESSAGES.NO_PERMISSION_SUBMIT_ATTEMPT);
    }

    if (attempt.status === AttemptStatus.DOING) {
      throw new BadRequestException(
        'Attempt has not been submitted yet, review is unavailable',
      );
    }

    const questionLinks = await this.questionBankQuestionRepo.find({
      where: { questionBankId: attempt.questionBankId },
      order: { orderNo: 'ASC' },
    });
    const questionIds = questionLinks.map((item) => item.questionId);

    const studentAnswers = questionIds.length
      ? await this.studentAnswerRepo.find({
          where: { attemptId: attempt.id, questionId: In(questionIds) },
        })
      : [];
    const studentAnswerMap = new Map(
      studentAnswers.map((item) => [item.questionId, item]),
    );

    const rootQuestions = questionIds.length
      ? await this.questionRepo.find({ where: { id: In(questionIds) } })
      : [];
    const questionMap = new Map(rootQuestions.map((item) => [item.id, item]));

    const { answersByQuestionId } =
      await this.questionBankQuestionPayloadService.buildQuestionBankQuestionPayload(
        attempt.questionBankId,
      );

    const questions: AttemptReviewQuestionItemDto[] = [];

    for (const link of questionLinks) {
      const rootQuestion = questionMap.get(link.questionId);
      if (!rootQuestion) {
        continue;
      }

      const studentAnswer = studentAnswerMap.get(link.questionId);
      const selectedIds = [
        ...(studentAnswer?.answerId ? [studentAnswer.answerId] : []),
        ...(studentAnswer?.selectedAnswerIds ?? []),
      ];
      const selectedIdSet = new Set(selectedIds);
      const questionChain = await this.loadQuestionChain(rootQuestion.id);
      const answerOptions = answersByQuestionId.get(rootQuestion.id) ?? [];
      const mappedAnswers = await this.mapAttemptReviewAnswerOptions(
        rootQuestion,
        answerOptions,
        selectedIdSet,
      );

      questions.push({
        id: rootQuestion.id,
        orderNo: link.orderNo,
        points: link.points,
        type: rootQuestion.type,
        contentType: rootQuestion.contentType,
        content: rootQuestion.content,
        nextContent: rootQuestion.nextContent ?? questionChain[1]?.id ?? null,
        chain: this.mapQuestionChain(questionChain),
        answers: mappedAnswers,
        studentAnswerId: studentAnswer?.id ?? null,
        answerId: studentAnswer?.answerId ?? null,
        selectedAnswerIds: selectedIds,
        textValue: studentAnswer?.textValue ?? null,
        description: studentAnswer?.description ?? null,
        isCorrect: studentAnswer?.isCorrect ?? null,
        pointsEarned: studentAnswer?.pointsEarned ?? null,
        timeSpentSec: studentAnswer?.timeSpentSec ?? null,
      });
    }

    return {
      attemptId: attempt.id,
      status: attempt.status,
      studentId: attempt.studentId,
      questionBankId: attempt.questionBankId,
      examSetId: attempt.examSetId,
      submittedAt: attempt.submittedAt ?? null,
      score: attempt.score ?? null,
      totalQuestions: questionLinks.length,
      answeredQuestions: studentAnswers.length,
      questions,
    };
  }

  async findExamHistory(
    user: JwtPayload,
    fromDate?: string,
    toDate?: string,
  ): Promise<AttemptExamHistoryItemDto[]> {
    if (!user?.userId) {
      throw new ForbiddenException(ERROR_MESSAGES.INVALID_TOKEN_STRUCTURE);
    }

    this.validateDateRange(fromDate, toDate);

    const qb = this.attemptRepo
      .createQueryBuilder('attempt')
      .innerJoin('attempt.questionBank', 'questionBank')
      .select('DATE(attempt.started_at)', 'date')
      .addSelect('questionBank.id', 'questionBankId')
      .addSelect('attempt.examSetId', 'examSetId')
      .addSelect('questionBank.name', 'examName')
      .addSelect('COUNT(attempt.id)', 'attemptCount')
      .where('attempt.studentId = :userId', { userId: user.userId });

    if (fromDate) {
      qb.andWhere('DATE(attempt.started_at) >= :fromDate', { fromDate });
    }

    if (toDate) {
      qb.andWhere('DATE(attempt.started_at) <= :toDate', { toDate });
    }

    const rows = await qb
      .groupBy('DATE(attempt.started_at)')
      .addGroupBy('questionBank.id')
      .addGroupBy('attempt.examSetId')
      .addGroupBy('questionBank.name')
      .orderBy('DATE(attempt.started_at)', 'DESC')
      .addOrderBy('questionBank.name', 'ASC')
      .getRawMany<{
        date: string;
        questionBankId: string;
        examSetId: string;
        examName: string;
        attemptCount: string;
      }>();

    return rows.map((row) => ({
      date: row.date,
      questionBankId: row.questionBankId,
      examSetId: row.examSetId,
      examName: row.examName,
      attemptCount: Number(row.attemptCount) || 0,
    }));
  }

  async findExamHistoryDetail(
    user: JwtPayload,
    date: string,
    questionBankId: string,
    examSetId: string,
  ): Promise<AttemptResponseDto[]> {
    if (!user?.userId) {
      throw new ForbiddenException(ERROR_MESSAGES.INVALID_TOKEN_STRUCTURE);
    }

    this.validateDate(date, 'date');

    const attempts = await this.attemptRepo
      .createQueryBuilder('attempt')
      .where('attempt.studentId = :userId', { userId: user.userId })
      .andWhere('attempt.questionBankId = :questionBankId', { questionBankId })
      .andWhere('attempt.examSetId = :examSetId', { examSetId })
      .andWhere('DATE(attempt.started_at) = :date', { date })
      .orderBy('attempt.startedAt', 'DESC')
      .getMany();

    return autoMapListToDto(AttemptResponseDto, attempts);
  }

  async findByExam(
    user: JwtPayload,
    questionBankId: string,
    examSetId: string,
  ): Promise<AttemptResponseDto[]> {
    if (!user?.userId) {
      throw new ForbiddenException(ERROR_MESSAGES.INVALID_TOKEN_STRUCTURE);
    }

    const attempts = await this.attemptRepo.find({
      where: {
        studentId: user.userId,
        questionBankId,
        examSetId,
      },
      order: {
        startedAt: 'DESC',
      },
    });

    return autoMapListToDto(AttemptResponseDto, attempts);
  }

  private validateDateRange(fromDate?: string, toDate?: string): void {
    if (fromDate) {
      this.validateDate(fromDate, 'fromDate');
    }

    if (toDate) {
      this.validateDate(toDate, 'toDate');
    }

    if (fromDate && toDate && fromDate > toDate) {
      throw new BadRequestException(
        'fromDate must be less than or equal to toDate',
      );
    }
  }

  private validateDate(value: string, fieldName: string): void {
    const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!isoDateRegex.test(value)) {
      throw new BadRequestException(
        `${fieldName} must be in YYYY-MM-DD format`,
      );
    }
  }

  async findOne(id: string): Promise<AttemptEntity> {
    const record = await this.attemptRepo.findOne({
      where: { id },
      relations: ['student', 'questionBank', 'examSet'],
    });

    if (!record) {
      throw new NotFoundException(
        ERROR_MESSAGES.NOT_FOUND_WITH_ID(ENTITY_NAMES.ATTEMPT ?? 'Bai lam', id),
      );
    }

    return record;
  }

  async update(id: string, dto: UpdateAttemptDto): Promise<AttemptEntity> {
    const record = await this.findOne(id);

    if (dto.studentId !== undefined) {
      await this.studentService.findOne(dto.studentId);
      record.studentId = dto.studentId;
    }

    if (dto.questionBankId !== undefined) {
      await this.questionBankService.findOne(dto.questionBankId);
      record.questionBankId = dto.questionBankId;
    }

    if (dto.examSetId !== undefined) {
      await this.examSetService.findOne(dto.examSetId);
      record.examSetId = dto.examSetId;
    }

    if (dto.status !== undefined) {
      record.status = dto.status;
    }

    if (dto.startedAt !== undefined) {
      record.startedAt = new Date(dto.startedAt);
    }

    if (dto.submittedAt !== undefined) {
      record.submittedAt = dto.submittedAt
        ? new Date(dto.submittedAt)
        : undefined;
    }

    if (dto.score !== undefined) {
      record.score = dto.score;
    }

    return this.attemptRepo.save(record);
  }

  async remove(id: string): Promise<void> {
    const record = await this.findOne(id);
    await this.attemptRepo.remove(record);
  }

  private async validateExamSetQuestionBank(
    examSetId: string,
    questionBankId: string,
  ): Promise<void> {
    await this.examSetQuestionBankService.validateExamSetQuestionBank(
      examSetId,
      questionBankId,
    );
  }

  private async ensureStudentProfile(userId: string): Promise<void> {
    const existingStudent = await this.studentRepo.findOne({
      where: { id: userId },
    });

    if (existingStudent) {
      return;
    }

    const user = await this.userRepo.findOne({
      where: { id: userId, userType: UserType.STUDENT },
    });

    if (!user) {
      throw new ForbiddenException(ERROR_MESSAGES.NO_PERMISSION_SUBMIT_ATTEMPT);
    }

    let school = await this.schoolRepo.findOne({
      where: { code: 'IMPORT' },
    });

    if (!school) {
      school = await this.schoolRepo.save(
        this.schoolRepo.create({
          code: 'IMPORT',
          name: 'Imported School',
          address: 'N/A',
          createdBy: userId,
        }),
      );
    }

    let studentGroup = await this.studentGroupRepo.findOne({
      where: { code: 1, schoolId: school.id },
    });

    if (!studentGroup) {
      studentGroup = await this.studentGroupRepo.save(
        this.studentGroupRepo.create({
          code: 1,
          name: 'Imported Students',
          schoolId: school.id,
          createdBy: userId,
        }),
      );
    }

    const preferredCode = user.userName || `student-${user.id.slice(0, 8)}`;
    const duplicateCode = await this.studentRepo.findOne({
      where: { code: preferredCode },
    });
    const studentCode = duplicateCode
      ? `${preferredCode}-${user.id.slice(0, 8)}`
      : preferredCode;

    await this.studentRepo.save(
      this.studentRepo.create({
        id: user.id,
        studentGroupId: studentGroup.id,
        code: studentCode,
        createdBy: userId,
      }),
    );
  }

  private async getExamQuestions(
    questionBankId: string,
  ): Promise<AttemptQuestionItemDto[]> {
    const { links, rootQuestions, answersByQuestionId } =
      await this.questionBankQuestionPayloadService.buildQuestionBankQuestionPayload(
        questionBankId,
      );
    const questionMap = new Map(rootQuestions.map((item) => [item.id, item]));

    const result: AttemptQuestionItemDto[] = [];

    for (const link of links) {
      const rootQuestion = questionMap.get(link.questionId);
      if (!rootQuestion) {
        continue;
      }

      const questionChain = await this.loadQuestionChain(rootQuestion.id);
      const answerOptions = answersByQuestionId.get(rootQuestion.id) ?? [];
      const mappedAnswers = await this.mapAttemptAnswerOptions(
        rootQuestion,
        answerOptions,
      );

      result.push({
        id: rootQuestion.id,
        orderNo: link.orderNo,
        points: link.points,
        type: rootQuestion.type,
        contentType: rootQuestion.contentType,
        content: rootQuestion.content,
        nextContent: rootQuestion.nextContent ?? questionChain[1]?.id ?? null,
        chain: this.mapQuestionChain(questionChain, { hideIsCorrect: true }),
        answers: mappedAnswers,
      });
    }

    return result;
  }

  private async loadQuestionChain(id: string): Promise<QuestionEntity[]> {
    const chain: QuestionEntity[] = [];
    let currentId: string | undefined = id;
    let depth = 0;

    while (currentId && depth < 10) {
      const item = await this.questionRepo.findOne({
        where: { id: currentId },
      });
      if (!item) {
        break;
      }
      chain.push(item);
      currentId = item.nextContent;
      depth++;
    }

    return chain;
  }

  private async loadAnswerChain(id: string): Promise<AnswerEntity[]> {
    const chain: AnswerEntity[] = [];
    let currentId: string | undefined = id;
    let depth = 0;

    while (currentId && depth < 10) {
      const item = await this.answerRepo.findOne({ where: { id: currentId } });
      if (!item) {
        break;
      }
      chain.push(item);
      currentId = item.nextContent;
      depth++;
    }

    return chain;
  }

  private async normalizeSubmittedAnswers(
    answers: Array<EndAttemptAnswerDto | string>,
    questionLinks: QuestionBankQuestionEntity[],
  ): Promise<EndAttemptAnswerDto[]> {
    if (answers.length === 0) {
      return [];
    }

    if (typeof answers[0] !== 'string') {
      return answers as EndAttemptAnswerDto[];
    }

    const questionOrderMap = new Map(
      questionLinks.map((item) => [item.orderNo, item.questionId]),
    );
    const questionIdByPosition = questionLinks.map((item) => item.questionId);
    const { answersByQuestionId } =
      await this.questionBankQuestionPayloadService.buildQuestionBankQuestionPayload(
        questionLinks[0]?.questionBankId ?? '',
      );

    return answers.map((item) => {
      if (typeof item !== 'string') {
        return item;
      }

      const trimmed = item.trim().toUpperCase();
      const matched = trimmed.match(/^(\d+)([A-Z]+)$/);
      if (!matched) {
        throw new BadRequestException(ERROR_MESSAGES.INVALID_INPUT);
      }

      const orderNo = Number(matched[1]);
      const choiceCodes = [...new Set(matched[2].split(''))];
      const questionId =
        questionOrderMap.get(orderNo) ?? questionIdByPosition[orderNo - 1];

      if (!questionId) {
        throw new BadRequestException(ERROR_MESSAGES.INVALID_INPUT);
      }

      const questionAnswers = [...(answersByQuestionId.get(questionId) ?? [])];
      questionAnswers.sort(
        (a, b) =>
          (a.orderNo ?? Number.MAX_SAFE_INTEGER) -
          (b.orderNo ?? Number.MAX_SAFE_INTEGER),
      );
      const selectedAnswerIds = choiceCodes.map((choiceCode) => {
        const answerOrderNo = choiceCode.charCodeAt(0) - 64;
        const answer =
          questionAnswers.find((item) => item.orderNo === answerOrderNo) ??
          questionAnswers[answerOrderNo - 1];
        if (!answer) {
          throw new BadRequestException(ERROR_MESSAGES.INVALID_INPUT);
        }
        return answer.id;
      });

      return {
        questionId,
        answerId:
          selectedAnswerIds.length === 1 ? selectedAnswerIds[0] : undefined,
        selectedAnswerIds:
          selectedAnswerIds.length > 1 ? selectedAnswerIds : undefined,
      };
    });
  }

  private mapQuestionChain(
    chain: QuestionEntity[],
    options?: { hideIsCorrect?: boolean },
  ): AttemptQuestionChainItemDto[] {
    return chain.map((item, index) => ({
      id: item.id,
      type: item.type,
      contentType: item.contentType,
      content: item.content,
      meta: this.sanitizeAttemptMeta(item.meta, options?.hideIsCorrect),
      nextContent: item.nextContent ?? chain[index + 1]?.id ?? null,
    }));
  }

  private async mapAttemptAnswerOptions(
    question: QuestionEntity,
    answerOptions: AnswerEntity[],
  ): Promise<AttemptAnswerOptionDto[]> {
    if (this.shouldHideAnswerOptions(question.type)) {
      return [];
    }

    return Promise.all(
      answerOptions.map(async (answer) => {
        const chain = await this.loadAnswerChain(answer.id);
        return this.mapAnswerChain(chain, { hideIsCorrect: true });
      }),
    );
  }

  private async mapAttemptReviewAnswerOptions(
    question: QuestionEntity,
    answerOptions: AnswerEntity[],
    selectedIdSet: Set<string>,
  ): Promise<AttemptReviewAnswerOptionDto[]> {
    if (this.shouldHideAnswerOptions(question.type)) {
      return [];
    }

    return Promise.all(
      answerOptions.map(async (answer) => {
        const chain = await this.loadAnswerChain(answer.id);
        const mappedChain = this.mapAnswerChain(chain);

        return {
          ...mappedChain,
          isCorrect: Boolean(answer.isCorrect),
          isSelected: selectedIdSet.has(answer.id),
        };
      }),
    );
  }

  private shouldHideAnswerOptions(questionType: QuestionType): boolean {
    return (
      questionType === QuestionType.MATCHING ||
      questionType === QuestionType.ORDERING
    );
  }

  private validateSubmittedAnswerByQuestionType(
    submitted: EndAttemptAnswerDto,
    questionType: QuestionType,
  ): void {
    const selectedCount = submitted.selectedAnswerIds?.length ?? 0;
    const hasAnswerId = Boolean(submitted.answerId);
    const hasTextValue = Boolean(submitted.textValue?.trim());

    if (questionType === QuestionType.SINGLE_CHOICE) {
      if (!hasAnswerId || selectedCount > 0 || hasTextValue) {
        throw new BadRequestException(
          'SINGLE_CHOICE question must submit exactly one answerId',
        );
      }
      return;
    }

    if (questionType === QuestionType.MULTIPLE_CHOICE) {
      if (hasTextValue || (!hasAnswerId && selectedCount === 0)) {
        throw new BadRequestException(
          'MULTIPLE_CHOICE question must submit answerId or selectedAnswerIds',
        );
      }
      return;
    }

    if (
      questionType === QuestionType.MATCHING ||
      questionType === QuestionType.ORDERING
    ) {
      return;
    }

    if (!hasTextValue || hasAnswerId || selectedCount > 0) {
      throw new BadRequestException(
        'TEXT_INPUT question must submit textValue only',
      );
    }
  }

  private mapAnswerChain(
    chain: AnswerEntity[],
    options?: { hideIsCorrect?: boolean },
  ): AttemptAnswerOptionDto {
    const root = chain[0];
    const mappedParts: AttemptAnswerChainItemDto[] = chain.map(
      (item, index) => ({
        id: item.id,
        contentType: item.contentType,
        content: item.content,
        meta: this.sanitizeAttemptMeta(item.meta, options?.hideIsCorrect),
        nextContent: item.nextContent ?? chain[index + 1]?.id ?? null,
      }),
    );

    return {
      id: root.id,
      contentType: root.contentType,
      content: root.content,
      meta: this.sanitizeAttemptMeta(root.meta, options?.hideIsCorrect),
      nextContent: root.nextContent ?? chain[1]?.id ?? null,
      chain: mappedParts,
    };
  }

  private sanitizeAttemptMeta(
    meta?: Record<string, unknown> | null,
    hideIsCorrect = false,
  ): Record<string, unknown> | null {
    if (!meta) {
      return null;
    }

    if (
      !hideIsCorrect ||
      !Object.prototype.hasOwnProperty.call(meta, 'isCorrect')
    ) {
      return meta;
    }

    const { isCorrect: _isCorrect, ...sanitizedMeta } = meta;
    return Object.keys(sanitizedMeta).length > 0 ? sanitizedMeta : null;
  }
}
