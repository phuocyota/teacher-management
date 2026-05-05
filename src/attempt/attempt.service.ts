import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PDFDocument, rgb, type PDFFont } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { promises as fs } from 'fs';
import * as path from 'path';
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
import { GroupMemberRole } from 'src/user-group/enum/group-member-role.enum';
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
import { ContentTypes } from 'src/common/enum/content-type.enum';

const PDF_STANDARD_FONT_DIR = path.join(
  process.cwd(),
  'node_modules',
  'dejavu-fonts-ttf',
  'ttf',
);
const PDF_REGULAR_FONT_PATH = path.join(
  PDF_STANDARD_FONT_DIR,
  'DejaVuSans.ttf',
);
const PDF_BOLD_FONT_PATH = path.join(
  PDF_STANDARD_FONT_DIR,
  'DejaVuSans-Bold.ttf',
);

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

    const questionBank = await this.questionBankService.findOne(
      dto.questionBankId,
    );
    const examSet = await this.examSetService.findOne(dto.examSetId);
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
      questionBankName: questionBank.name,
      examSetId: savedAttempt.examSetId,
      examSetName: examSet.name,
      examName: questionBank.name,
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

    let earnedScore = 0;

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

        earnedScore += pointsEarned;

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
    attempt.score = earnedScore;
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
      if (attempt.questionBank?.totalMarks) {
        dto.fullScore = attempt.questionBank.totalMarks;
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

  async getMyStatistics(userId: string) {
    // Get total submitted attempts and calculate average, highest score
    const attempts = await this.attemptRepo
      .createQueryBuilder('attempt')
      .where('attempt.studentId = :studentId', { studentId: userId })
      .andWhere('attempt.status = :status', { status: AttemptStatus.SUBMITTED })
      .getMany();

    const totalAttempts = attempts.length;

    if (totalAttempts === 0) {
      return {
        totalAttempts: 0,
        averageScore: null,
        highestScore: null,
        percentileRank: null,
      };
    }

    // Calculate average and highest score
    const scores = attempts
      .map((a) => a.score)
      .filter((s) => s !== null && s !== undefined) as number[];

    const averageScore =
      scores.length > 0
        ? parseFloat(
            (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2),
          )
        : null;

    const highestScore = scores.length > 0 ? Math.max(...scores) : null;

    // Calculate percentile rank
    let percentileRank: number | null = null;

    if (highestScore !== null) {
      // Count how many students have highest score >= this student's highest score
      const betterOrEqualCount = await this.attemptRepo
        .createQueryBuilder('attempt')
        .select('COUNT(DISTINCT attempt.studentId)', 'count')
        .leftJoin('attempt.student', 'student')
        .where('attempt.status = :status', { status: AttemptStatus.SUBMITTED })
        .andWhere('attempt.score >= :score', { score: highestScore })
        .getRawOne();

      // Get total unique students
      const totalStudents = await this.attemptRepo
        .createQueryBuilder('attempt')
        .select('COUNT(DISTINCT attempt.studentId)', 'count')
        .where('attempt.status = :status', { status: AttemptStatus.SUBMITTED })
        .getRawOne();

      if (totalStudents?.count > 0) {
        percentileRank = Math.round(
          ((totalStudents.count - (betterOrEqualCount?.count || 0)) /
            totalStudents.count) *
            100,
        );
      }
    }

    return {
      totalAttempts,
      averageScore,
      highestScore,
      percentileRank,
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

  async exportAttemptReviewPdf(
    id: string,
    user: JwtPayload,
  ): Promise<{ buffer: Buffer; fileName: string }> {
    const attempt = await this.attemptRepo.findOne({
      where: { id },
      relations: ['questionBank', 'examSet', 'student'],
    });

    if (!attempt || !user?.userId) {
      throw new NotFoundException(
        ERROR_MESSAGES.NOT_FOUND_WITH_ID(ENTITY_NAMES.ATTEMPT, id),
      );
    }

    await this.ensureCanExportAttempt(attempt, user);

    const review = await this.buildAttemptReviewForExport(attempt);

    const student = await this.userRepo.findOne({
      where: { id: review.studentId },
    });

    const buffer = await this.buildAttemptReviewPdf(review, {
      studentName: student?.fullName ?? student?.userName ?? user.userId,
      studentUserName: student?.userName ?? '',
      examSetName: attempt.examSet?.name ?? '',
      questionBankName: attempt.questionBank?.name ?? '',
      startedAt: attempt.startedAt,
      submittedAt: attempt.submittedAt ?? null,
    });

    return {
      buffer,
      fileName: `attempt-review-${this.toSafeFileName(review.attemptId)}.pdf`,
    };
  }

  async exportBestAttemptReviewPdf(
    user: JwtPayload,
    studentId: string,
    questionBankId: string,
  ): Promise<{ buffer: Buffer; fileName: string }> {
    const bestAttempt = await this.attemptRepo
      .createQueryBuilder('attempt')
      .where('attempt.student_id = :studentId', { studentId })
      .andWhere('attempt.question_bank_id = :questionBankId', {
        questionBankId,
      })
      .andWhere('attempt.submitted_at IS NOT NULL')
      .orderBy('attempt.score', 'DESC', 'NULLS LAST')
      .addOrderBy('attempt.submitted_at', 'DESC')
      .getOne();

    if (!bestAttempt) {
      throw new NotFoundException(
        'Khong tim thay lan lam bai da nop cua hoc sinh voi questionBankId nay',
      );
    }

    return this.exportAttemptReviewPdf(bestAttempt.id, user);
  }

  private async ensureCanExportAttempt(
    attempt: AttemptEntity,
    user: JwtPayload,
  ): Promise<void> {
    if (user.userType === UserType.ADMIN) {
      return;
    }

    if (user.userType === UserType.STUDENT) {
      if (attempt.studentId !== user.userId) {
        throw new ForbiddenException(
          ERROR_MESSAGES.NO_PERMISSION_SUBMIT_ATTEMPT,
        );
      }
      return;
    }

    const student = await this.studentRepo.findOne({
      where: { id: attempt.studentId },
    });

    if (!student?.studentGroupId) {
      throw new ForbiddenException('Khong tim thay lop cua hoc sinh');
    }

    const accessibleCount = await this.studentGroupRepo
      .createQueryBuilder('studentGroup')
      .innerJoin('studentGroup.school', 'school')
      .where('studentGroup.id = :groupId', { groupId: student.studentGroupId })
      .andWhere(
        `(
          school.principal_user_id = :userId
          OR EXISTS (
            SELECT 1
            FROM student_group_member studentGroupMember
            WHERE studentGroupMember.user_id = :userId
              AND studentGroupMember.role = :leaderRole
              AND studentGroupMember.student_group_id = "studentGroup".id
          )
        )`,
        {
          userId: user.userId,
          leaderRole: GroupMemberRole.LEADER,
        },
      )
      .getCount();

    if (!accessibleCount) {
      throw new ForbiddenException(
        'Ban khong co quyen xuat bai lam cua hoc sinh nay',
      );
    }
  }

  private async buildAttemptReviewForExport(
    attempt: AttemptEntity,
  ): Promise<AttemptReviewResponseDto> {
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

  private async buildAttemptReviewPdf(
    review: AttemptReviewResponseDto,
    meta: {
      studentName: string;
      studentUserName: string;
      examSetName: string;
      questionBankName: string;
      startedAt: Date;
      submittedAt: Date | null;
    },
  ): Promise<Buffer> {
    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);
    const font = await pdfDoc.embedFont(await fs.readFile(PDF_REGULAR_FONT_PATH), {
      subset: false,
    });
    const boldFont = await pdfDoc.embedFont(
      await fs.readFile(PDF_BOLD_FONT_PATH),
      { subset: false },
    );
    const pageSize: [number, number] = [595.28, 841.89];
    const margin = 40;
    const contentWidth = pageSize[0] - margin * 2;

    let page = pdfDoc.addPage(pageSize);
    let y = page.getHeight() - margin;

    const ensureSpace = (heightNeeded: number) => {
      if (y - heightNeeded < margin) {
        page = pdfDoc.addPage(pageSize);
        y = page.getHeight() - margin;
      }
    };

    const drawWrappedText = (
      text: string,
      options?: {
        size?: number;
        bold?: boolean;
        indent?: number;
        color?: ReturnType<typeof rgb>;
        gapAfter?: number;
      },
    ) => {
      const size = options?.size ?? 11;
      const lineHeight = size + 4;
      const indent = options?.indent ?? 0;
      const targetFont = options?.bold ? boldFont : font;
      const lines = this.wrapPdfText(
        this.toPdfText(text),
        targetFont,
        size,
        contentWidth - indent,
      );

      ensureSpace(lines.length * lineHeight + 4);

      for (const line of lines) {
        page.drawText(line, {
          x: margin + indent,
          y,
          size,
          font: targetFont,
          color: options?.color ?? rgb(0.12, 0.12, 0.12),
        });
        y -= lineHeight;
      }

      y -= options?.gapAfter ?? 2;
    };

    const drawContentItem = async (
      item: {
        contentType: string;
        content: string;
      },
      options?: {
        size?: number;
        bold?: boolean;
        indent?: number;
        color?: ReturnType<typeof rgb>;
        gapAfter?: number;
      },
    ) => {
      if (this.shouldTreatAsImage(item)) {
        const imageRendered = await this.tryDrawPdfImage(
          pdfDoc,
          item.content,
          {
            ensureSpace,
            getPage: () => page,
            setPage: (nextPage) => {
              page = nextPage;
            },
            getY: () => y,
            setY: (nextY) => {
              y = nextY;
            },
            margin,
            pageSize,
            maxWidth: contentWidth - (options?.indent ?? 0),
            indent: options?.indent ?? 0,
          },
        );

        if (imageRendered) {
          y -= options?.gapAfter ?? 4;
          return;
        }
      }

      drawWrappedText(this.toDisplayContent(item.content), options);
    };

    drawWrappedText('PHIẾU XUẤT BÀI LÀM', {
      size: 16,
      bold: true,
      gapAfter: 8,
    });
    drawWrappedText(`Học sinh: ${meta.studentName}`, { bold: true });
    drawWrappedText(`Tài khoản: ${meta.studentUserName || '-'}`);
    drawWrappedText(`Bộ đề: ${meta.examSetName || '-'}`);
    drawWrappedText(`Đề thi: ${meta.questionBankName || '-'}`);
    drawWrappedText(`Bắt đầu: ${this.formatDateTime(meta.startedAt)}`);
    drawWrappedText(
      `Nộp bài: ${
        meta.submittedAt ? this.formatDateTime(meta.submittedAt) : '-'
      }`,
    );
    drawWrappedText(
      `Tổng điểm: ${review.score ?? 0} | Số câu: ${review.totalQuestions} | Đã trả lời: ${review.answeredQuestions}`,
      { gapAfter: 10 },
    );

    for (const question of review.questions) {
      drawWrappedText(
        `Câu ${question.orderNo} - ${question.pointsEarned ?? 0}/${question.points} điểm - ${
          question.isCorrect === true
            ? 'Đúng'
            : question.isCorrect === false
              ? 'Sai'
              : 'Chưa chấm'
        }`,
        {
          bold: true,
          color:
            question.isCorrect === true
              ? rgb(0, 0.45, 0.2)
              : question.isCorrect === false
                ? rgb(0.7, 0.1, 0.1)
                : rgb(0.2, 0.2, 0.2),
        },
      );

      const questionItems = [
        { contentType: question.contentType, content: question.content },
        ...question.chain.slice(1).map((item) => ({
          contentType: item.contentType,
          content: item.content,
        })),
      ];
      for (const item of questionItems) {
        await drawContentItem(item, { indent: 12 });
      }

      if (question.textValue) {
        drawWrappedText(`Trả lời tự luận: ${question.textValue}`, {
          indent: 12,
        });
      }

      for (const answer of question.answers) {
        const isSelected = answer.isSelected;
        const label = isSelected ? '[x]' : '[ ]';
        const correctness = answer.isCorrect ? ' (đáp án đúng)' : '';
        const optionLabel = this.getAttemptAnswerOptionLabel(answer, question);
        const answerItems = [
          { contentType: answer.contentType, content: answer.content },
          ...answer.chain.slice(1).map((item) => ({
            contentType: item.contentType,
            content: item.content,
          })),
        ];
        await drawContentItem(
          {
            contentType: answerItems[0].contentType,
            content: `${label} ${optionLabel} ${this.toDisplayContent(answerItems[0].content)}${correctness}`,
          },
          { indent: 18 },
        );
        for (const extraItem of answerItems.slice(1)) {
          await drawContentItem(extraItem, { indent: 36 });
        }
      }

      if (question.description) {
        drawWrappedText(`Ghi chú: ${question.description}`, { indent: 12 });
      }

      y -= 4;
    }

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  }

  private wrapPdfText(
    text: string,
    font: PDFFont,
    size: number,
    maxWidth: number,
  ): string[] {
    const words = text.split(/\s+/).filter(Boolean);
    if (!words.length) {
      return [''];
    }

    const lines: string[] = [];
    let current = '';

    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        current = candidate;
        continue;
      }

      if (current) {
        lines.push(current);
      }
      current = word;
    }

    if (current) {
      lines.push(current);
    }

    return lines;
  }

  private toPdfText(value: string): string {
    return (value ?? '')
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n');
  }

  private toDisplayContent(value: string): string {
    const trimmed = (value ?? '').trim();
    if (!trimmed) {
      return '';
    }
    if (/^\/?uploads\/|^https?:\/\//i.test(trimmed)) {
      return `[Hình ảnh] ${trimmed}`;
    }
    return trimmed;
  }

  private shouldTreatAsImage(item: { contentType: string; content: string }): boolean {
    return (
      item.contentType === ContentTypes.IMAGE ||
      /^\/?uploads\//i.test(item.content ?? '') ||
      /^https?:\/\/.+\.(png|jpg|jpeg|webp)(\?.*)?$/i.test(item.content ?? '')
    );
  }

  private async tryDrawPdfImage(
    pdfDoc: PDFDocument,
    rawContent: string,
    context: {
      ensureSpace: (heightNeeded: number) => void;
      getPage: () => any;
      setPage: (nextPage: any) => void;
      getY: () => number;
      setY: (nextY: number) => void;
      margin: number;
      pageSize: [number, number];
      maxWidth: number;
      indent: number;
    },
  ): Promise<boolean> {
    try {
      const imageBuffer = await this.resolvePdfImageBuffer(rawContent);
      if (!imageBuffer) {
        return false;
      }

      const embedded = this.isPngBuffer(imageBuffer)
        ? await pdfDoc.embedPng(imageBuffer)
        : await pdfDoc.embedJpg(imageBuffer);

      const scaled = embedded.scale(1);
      const widthRatio =
        scaled.width > context.maxWidth ? context.maxWidth / scaled.width : 1;
      const targetWidth = scaled.width * widthRatio;
      const targetHeight = scaled.height * widthRatio;

      context.ensureSpace(targetHeight + 10);
      const page = context.getPage();
      const currentY = context.getY();

      page.drawImage(embedded, {
        x: context.margin + context.indent,
        y: currentY - targetHeight,
        width: targetWidth,
        height: targetHeight,
      });

      context.setY(currentY - targetHeight - 6);
      return true;
    } catch {
      return false;
    }
  }

  private async resolvePdfImageBuffer(rawContent: string): Promise<Buffer | null> {
    const trimmed = (rawContent ?? '').trim();
    if (!trimmed) {
      return null;
    }

    const httpCandidates = this.buildPdfImageHttpCandidates(trimmed);
    for (const candidate of httpCandidates) {
      try {
        const response = await fetch(candidate);
        if (!response.ok) {
          continue;
        }
        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
      } catch {
        continue;
      }
    }

    const candidatePaths = new Set<string>();
    const normalized = trimmed.replace(/\\/g, '/');
    if (normalized.startsWith('/uploads/')) {
      candidatePaths.add(path.join(process.cwd(), normalized.slice(1)));
    } else if (normalized.startsWith('uploads/')) {
      candidatePaths.add(path.join(process.cwd(), normalized));
    } else {
      candidatePaths.add(path.join(process.cwd(), normalized));
      candidatePaths.add(path.join(process.cwd(), 'uploads', normalized));
    }

    for (const candidate of candidatePaths) {
      try {
        return await fs.readFile(candidate);
      } catch {
        continue;
      }
    }

    return null;
  }

  private buildPdfImageHttpCandidates(rawContent: string): string[] {
    const trimmed = rawContent.trim();
    if (!trimmed) {
      return [];
    }

    if (/^https?:\/\//i.test(trimmed)) {
      return [trimmed];
    }

    const normalized = trimmed.replace(/\\/g, '/');
    const pathPart = normalized.startsWith('/') ? normalized : `/${normalized}`;
    const baseUrls = new Set<string>();

    if (process.env.PUBLIC_BASE_URL) {
      baseUrls.add(process.env.PUBLIC_BASE_URL.replace(/\/$/, ''));
    }

    if (process.env.DB_HOST) {
      baseUrls.add(`http://${process.env.DB_HOST}`.replace(/\/$/, ''));
    }

    baseUrls.add('https://be.kidostudent.kidoedu.vn');

    return [...baseUrls].map((baseUrl) => `${baseUrl}${pathPart}`);
  }

  private isPngBuffer(buffer: Buffer): boolean {
    return (
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    );
  }

  private getAttemptAnswerOptionLabel(
    answer: AttemptReviewAnswerOptionDto,
    question: AttemptReviewQuestionItemDto,
  ): string {
    const rawLabel =
      answer.meta &&
      typeof answer.meta === 'object' &&
      typeof answer.meta.importOptionLabel === 'string'
        ? answer.meta.importOptionLabel
        : null;

    if (rawLabel) {
      return `${rawLabel}.`;
    }

    const answerIndex = question.answers.findIndex((item) => item.id === answer.id);
    if (answerIndex >= 0 && answerIndex < 26) {
      return `${String.fromCharCode(65 + answerIndex)}.`;
    }

    return '-';
  }

  private toSafeFileName(value: string): string {
    return this.toPdfText(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private formatDateTime(value: Date): string {
    return value.toISOString().replace('T', ' ').slice(0, 19);
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

      if (this.isAnswerKeyNode(item)) {
        break;
      }

      chain.push(item);
      currentId = item.nextContent;
      depth++;
    }

    return chain;
  }

  private isAnswerKeyNode(answer: AnswerEntity): boolean {
    if (answer.contentType !== 'TEXT') {
      return false;
    }

    const text = answer.content?.trim() ?? '';
    return /^(\*|\u2022)?\s*(Đáp\s*án|Dap\s*an|Answer\s*Key)\b/iu.test(text);
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
