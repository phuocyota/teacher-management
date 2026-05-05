import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from 'pdf-lib';
import { Workbook, type Row, type Worksheet } from 'exceljs';
import { existsSync } from 'fs';
import { join } from 'path';
import { Repository } from 'typeorm';
import { AttemptEntity } from 'src/attempt/attempt.entity';
import {
  ERROR_MESSAGES,
  ENTITY_NAMES,
} from 'src/common/constant/error-messages.constant';
import { JwtPayload } from 'src/common/interface/jwt-payload.interface';
import { QuestionBankQuestionEntity } from 'src/question-bank-question/question-bank-question.entity';
import { UserEntity } from 'src/user/user.entity';
import { UserType } from 'src/common/enum/user-type.enum';
import { StudentEntity } from 'src/student/student.entity';
import { StudentAnswerEntity } from 'src/student-answer/student-answer.entity';
import { StudentGroupEntity } from 'src/student-group/student-group.entity';
import { SchoolEntity } from 'src/school/school.entity';
import { GroupType } from 'src/group/enum/group-type.enum';
import { GroupMemberRole } from 'src/user-group/enum/group-member-role.enum';
import {
  ReportStudentOptionDto,
  StudentAttemptDto,
  StudentReportDto,
  StudentReportSummaryDto,
  StudentScoreTrendPointDto,
  TeacherLeaderGroupDto,
} from './dto/report.dto';

const STUDENT_ATTEMPT_DETAIL_TEMPLATE_PATH = join(
  process.cwd(),
  'templates',
  'student-attempt-detail.xlsx',
);
const CLASS_RESULT_TEMPLATE_PATH = join(
  process.cwd(),
  'templates',
  'template-excel-class.xlsx',
);
const SCHOOL_STAT_TEMPLATE_PATH = join(
  process.cwd(),
  'templates',
  'template-excel-school.xlsx',
);

type ReportStudentRow = {
  id: string;
  fullName: string | null;
  userName: string;
  code: string;
  studentGroupId: string | null;
  studentGroupName: string | null;
};

type SchoolAttemptReportFilters = {
  examSetId?: string;
  questionBankId?: string;
  fromDate?: string;
  toDate?: string;
};

type SchoolAttemptReportRow = {
  studentId: string;
  fullName: string | null;
  userName: string;
  studentCode: string;
  studentGroupId: string;
  studentGroupName: string;
  totalAttempts: string;
  averageScore: string | null;
  highestScore: string | null;
  latestAttemptAt: Date | null;
};

type ClassAttemptScoreExportRow = {
  studentId: string;
  studentCode: string;
  fullName: string | null;
  userName: string;
  attemptId: string | null;
  examSetId: string | null;
  examSetName: string | null;
  questionBankId: string | null;
  questionBankName: string | null;
  status: string | null;
  startedAt: Date | null;
  submittedAt: Date | null;
  score: string | number | null;
};

type StudentAttemptDetailRow = {
  orderNo: number;
  isCorrect: boolean | null;
  pointsEarned: string | number | null;
};

type StudentAttemptScoreStats = {
  attemptCount: number;
  highestScore: number | null;
  lowestScore: number | null;
  averageScore: number | null;
};

type StudentAttemptDetailContext = {
  attemptId: string;
  score: number | null;
  startedAt: Date;
  submittedAt: Date | null;
  studentId: string;
  studentCode: string;
  studentFullName: string | null;
  studentUserName: string;
  groupId: string | null;
  groupName: string | null;
  schoolName: string | null;
  examSetName: string | null;
  questionBankName: string | null;
  questionBankId: string;
};

type ClassSheetRawRow = {
  studentId: string;
  studentCode: string;
  fullName: string | null;
  userName: string;
  attemptId: string | null;
  examSetName: string | null;
  questionBankName: string | null;
  subjectName: string | null;
  startedAt: Date | null;
  submittedAt: Date | null;
  score: string | number | null;
};

type ClassSheetRow = {
  studentId: string;
  studentCode: string;
  fullName: string;
  subjectName: string;
  correctCount: number;
  score: number | null;
  resultLabel: string;
  startedAt: Date | null;
};

type SchoolStatRawRow = {
  studentId: string;
  studentCode: string;
  studentGroupId: string;
  studentGroupName: string;
  fullName: string | null;
  userName: string;
  attemptId: string | null;
  score: string | number | null;
  startedAt: Date | null;
};

type SchoolStatRow = {
  groupId: string;
  groupName: string;
  totalStudents: number;
  attemptedStudents: number;
  absentStudents: number;
  highestScore: number | null;
  lowestScore: number | null;
  underFiveCount: number;
  averageScore: number | null;
  passRate: number;
  ranking: number | null;
  assessment: string;
};

@Injectable()
export class ReportService {
  constructor(
    @InjectRepository(AttemptEntity)
    private readonly attemptRepo: Repository<AttemptEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(StudentEntity)
    private readonly studentRepo: Repository<StudentEntity>,
    @InjectRepository(StudentAnswerEntity)
    private readonly studentAnswerRepo: Repository<StudentAnswerEntity>,
    @InjectRepository(StudentGroupEntity)
    private readonly studentGroupRepo: Repository<StudentGroupEntity>,
    @InjectRepository(SchoolEntity)
    private readonly schoolRepo: Repository<SchoolEntity>,
    @InjectRepository(QuestionBankQuestionEntity)
    private readonly questionBankQuestionRepo: Repository<QuestionBankQuestionEntity>,
  ) {}

  async getLeaderGroups(user: JwtPayload): Promise<TeacherLeaderGroupDto[]> {
    this.ensureAuthenticatedUser(user);

    const qb = this.studentGroupRepo
      .createQueryBuilder('studentGroup')
      .innerJoin('studentGroup.school', 'school')
      .innerJoin(
        StudentEntity,
        'student',
        'student.student_group_id = studentGroup.id',
      )
      .select('studentGroup.id', 'id')
      .addSelect(
        "CONCAT(COALESCE(school.code, ''), CASE WHEN school.code IS NULL THEN '' ELSE ' - ' END, studentGroup.name)",
        'name',
      )
      .addSelect(':type', 'type')
      .setParameter('type', GroupType.CLASS)
      .groupBy('studentGroup.id')
      .addGroupBy('studentGroup.name')
      .addGroupBy('studentGroup.code')
      .addGroupBy('school.code')
      .where(
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
      .orderBy('school.code', 'ASC')
      .addOrderBy('studentGroup.code', 'ASC');

    const rows = await qb.getRawMany<TeacherLeaderGroupDto>();

    return rows;
  }

  private canAccessStudentGroupCondition(): string {
    return `(
      school.principal_user_id = :userId
      OR EXISTS (
        SELECT 1
        FROM student_group_member studentGroupMember
        WHERE studentGroupMember.user_id = :userId
          AND studentGroupMember.role = :leaderRole
          AND studentGroupMember.student_group_id = "studentGroup".id
      )
    )`;
  }

  private accessParams(userId: string): {
    userId: string;
    leaderRole: GroupMemberRole;
  } {
    return {
      userId,
      leaderRole: GroupMemberRole.LEADER,
    };
  }

  async getGroupStudents(
    groupId: string,
    user: JwtPayload,
  ): Promise<ReportStudentOptionDto[]> {
    this.ensureAuthenticatedUser(user);
    await this.ensureCanAccessStudentGroup(groupId, user);

    const rows = await this.getStudentRowsInGroup(groupId);
    return rows.map((row) => ({
      id: row.id,
      fullName: row.fullName,
      userName: row.userName,
      code: row.code,
      studentGroupId: row.studentGroupId,
      studentGroupName: row.studentGroupName,
    }));
  }

  async getStudentReport(
    user: JwtPayload,
    groupId: string,
    studentId: string,
    fromDate?: string,
    toDate?: string,
    page = 1,
    limit = 10,
  ): Promise<StudentReportDto> {
    this.ensureAuthenticatedUser(user);
    this.validateDateRange(fromDate, toDate);

    const safePage = Number.isFinite(page) && page > 0 ? page : 1;
    const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : 10;
    const skip = (safePage - 1) * safeLimit;

    await this.ensureCanAccessStudentGroup(groupId, user);
    const student = await this.ensureStudentBelongsToGroup(groupId, studentId);

    const summaryRaw = await this.buildAttemptScope(studentId, fromDate, toDate)
      .select('COUNT(attempt.id)', 'totalAttempts')
      .addSelect('AVG(attempt.score)', 'averageScore')
      .addSelect('MAX(attempt.score)', 'highestScore')
      .addSelect(
        'MAX(COALESCE(attempt.submitted_at, attempt.started_at))',
        'latestAttemptAt',
      )
      .getRawOne<{
        totalAttempts: string;
        averageScore: string | null;
        highestScore: string | null;
        latestAttemptAt: Date | null;
      }>();

    const summary: StudentReportSummaryDto = {
      totalAttempts: Number(summaryRaw?.totalAttempts ?? 0),
      averageScore: this.toNullableNumber(summaryRaw?.averageScore),
      highestScore: this.toNullableNumber(summaryRaw?.highestScore),
      latestAttemptAt: summaryRaw?.latestAttemptAt
        ? new Date(summaryRaw.latestAttemptAt)
        : null,
    };

    const trendRows = await this.buildAttemptScope(studentId, fromDate, toDate)
      .select('DATE(attempt.started_at)', 'date')
      .addSelect('COUNT(attempt.id)', 'attemptCount')
      .addSelect('AVG(attempt.score)', 'averageScore')
      .addSelect('MAX(attempt.score)', 'highestScore')
      .groupBy('DATE(attempt.started_at)')
      .orderBy('DATE(attempt.started_at)', 'ASC')
      .getRawMany<{
        date: string;
        attemptCount: string;
        averageScore: string | null;
        highestScore: string | null;
      }>();

    const trend: StudentScoreTrendPointDto[] = trendRows.map((row) => ({
      date: row.date,
      attemptCount: Number(row.attemptCount) || 0,
      averageScore: this.toNullableNumber(row.averageScore),
      highestScore: this.toNullableNumber(row.highestScore),
    }));

    const historyQb = this.buildAttemptScope(studentId, fromDate, toDate)
      .leftJoin('attempt.questionBank', 'questionBank')
      .leftJoin('attempt.examSet', 'examSet')
      .select('attempt.id', 'attemptId')
      .addSelect('attempt.questionBankId', 'questionBankId')
      .addSelect('questionBank.name', 'questionBankName')
      .addSelect('attempt.examSetId', 'examSetId')
      .addSelect('examSet.name', 'examSetName')
      .addSelect('attempt.status', 'status')
      .addSelect('attempt.started_at', 'startedAt')
      .addSelect('attempt.submitted_at', 'submittedAt')
      .addSelect('attempt.score', 'score')
      .orderBy('attempt.started_at', 'DESC')
      .offset(skip)
      .limit(safeLimit);

    const [historyRows, total] = await Promise.all([
      historyQb.getRawMany<{
        attemptId: string;
        questionBankId: string;
        questionBankName: string;
        examSetId: string;
        examSetName: string;
        status: StudentAttemptDto['status'];
        startedAt: Date;
        submittedAt: Date | null;
        score: string | null;
      }>(),
      this.buildAttemptScope(studentId, fromDate, toDate).getCount(),
    ]);

    const attempts: StudentAttemptDto[] = historyRows.map((row) => ({
      attemptId: row.attemptId,
      questionBankId: row.questionBankId,
      questionBankName: row.questionBankName,
      examSetId: row.examSetId,
      examSetName: row.examSetName,
      status: row.status,
      startedAt: new Date(row.startedAt),
      submittedAt: row.submittedAt ? new Date(row.submittedAt) : null,
      score: this.toNullableNumber(row.score),
    }));

    return {
      groupId,
      student,
      fromDate: fromDate ?? null,
      toDate: toDate ?? null,
      summary,
      trend,
      attempts,
      page: safePage,
      limit: safeLimit,
      total,
    };
  }

  async exportSchoolAttemptReportPdf(
    user: JwtPayload,
    schoolId: string,
    filters: SchoolAttemptReportFilters,
  ): Promise<{ buffer: Buffer; fileName: string }> {
    this.ensureAuthenticatedUser(user);
    this.validateDateRange(filters.fromDate, filters.toDate);

    const school = await this.schoolRepo.findOne({ where: { id: schoolId } });
    if (!school) {
      throw new NotFoundException(
        ERROR_MESSAGES.NOT_FOUND_WITH_ID(ENTITY_NAMES.SCHOOL, schoolId),
      );
    }

    this.ensureCanAccessSchoolReport(school, user);

    const rows = await this.getSchoolAttemptReportRows(schoolId, filters);
    const buffer = await this.buildSchoolAttemptReportPdf(
      school,
      rows,
      filters,
    );

    return {
      buffer,
      fileName: `school-attempt-report-${this.toSafeFileName(school.code)}.pdf`,
    };
  }

  async exportClassAttemptScoresExcel(
    user: JwtPayload,
    groupIds: string[],
    filters: SchoolAttemptReportFilters,
  ): Promise<{ buffer: Buffer; fileName: string }> {
    this.ensureAuthenticatedUser(user);
    this.validateDateRange(filters.fromDate, filters.toDate);

    const normalizedGroupIds = [
      ...new Set(groupIds.map((id) => id.trim())),
    ].filter(Boolean);

    if (normalizedGroupIds.length === 0) {
      throw new BadRequestException('groupIds la bat buoc');
    }

    const invalidGroupId = normalizedGroupIds.find((id) => !this.isUuid(id));
    if (invalidGroupId) {
      throw new BadRequestException(`groupId khong hop le: ${invalidGroupId}`);
    }

    const workbook = new Workbook();
    workbook.creator = 'teacher-management';
    workbook.created = new Date();

    for (const groupId of normalizedGroupIds) {
      await this.ensureCanAccessStudentGroup(groupId, user);
      const studentGroup = await this.studentGroupRepo.findOne({
        where: { id: groupId },
        relations: ['school'],
      });

      if (!studentGroup) {
        throw new NotFoundException(
          ERROR_MESSAGES.NOT_FOUND_WITH_ID(ENTITY_NAMES.STUDENT_GROUP, groupId),
        );
      }

      const rows = await this.getClassAttemptScoreRows(groupId, filters);
      this.addClassAttemptScoreWorksheet(workbook, studentGroup, rows);
    }

    const xlsx = await workbook.xlsx.writeBuffer();

    return {
      buffer: Buffer.from(xlsx),
      fileName: `class-attempt-scores-${this.formatDate(new Date())}.xlsx`,
    };
  }

  async exportStudentAttemptDetailExcel(
    user: JwtPayload,
    attemptId: string,
  ): Promise<{ buffer: Buffer; fileName: string }> {
    this.ensureAuthenticatedUser(user);

    const context = await this.getStudentAttemptDetailContext(attemptId);
    if (!context) {
      throw new NotFoundException(
        ERROR_MESSAGES.NOT_FOUND_WITH_ID(ENTITY_NAMES.ATTEMPT, attemptId),
      );
    }

    if (!context.groupId) {
      throw new NotFoundException('Hoc sinh chua duoc gan vao lop');
    }

    if (user.userType === UserType.STUDENT) {
      if (context.studentId !== user.userId) {
        throw new ForbiddenException('Ban khong co quyen xuat phieu diem nay');
      }
    } else {
      await this.ensureCanAccessStudentGroup(context.groupId, user);
    }

    const rows = await this.getStudentAttemptDetailRows(
      context.questionBankId,
      attemptId,
    );
    const stats = await this.getStudentAttemptScoreStats(
      context.studentId,
      context.questionBankId,
    );
    const workbook = await this.createStudentDetailWorkbook();

    this.addStudentDetailWorksheet(workbook, context, rows, stats);

    const xlsx = await workbook.xlsx.writeBuffer();
    return {
      buffer: Buffer.from(xlsx),
      fileName: `chi-tiet-hs-${this.toSafeFileName(context.studentCode)}.xlsx`,
    };
  }

  private async createStudentDetailWorkbook(): Promise<Workbook> {
    const workbook = new Workbook();
    workbook.creator = 'teacher-management';
    workbook.created = new Date();

    if (existsSync(STUDENT_ATTEMPT_DETAIL_TEMPLATE_PATH)) {
      await workbook.xlsx.readFile(STUDENT_ATTEMPT_DETAIL_TEMPLATE_PATH);
    }

    return workbook;
  }

  private async createClassResultWorkbook(): Promise<Workbook> {
    const workbook = new Workbook();
    workbook.creator = 'teacher-management';
    workbook.created = new Date();

    if (existsSync(CLASS_RESULT_TEMPLATE_PATH)) {
      await workbook.xlsx.readFile(CLASS_RESULT_TEMPLATE_PATH);
    }

    return workbook;
  }

  private async createSchoolStatWorkbook(): Promise<Workbook> {
    const workbook = new Workbook();
    workbook.creator = 'teacher-management';
    workbook.created = new Date();

    if (existsSync(SCHOOL_STAT_TEMPLATE_PATH)) {
      await workbook.xlsx.readFile(SCHOOL_STAT_TEMPLATE_PATH);
    }

    return workbook;
  }

  async exportCurrentStudentBestAttemptDetailExcel(
    user: JwtPayload,
    studentId: string,
    questionBankId: string,
  ): Promise<{ buffer: Buffer; fileName: string }> {
    this.ensureAuthenticatedUser(user);

    if (user.userType === UserType.STUDENT && user.userId !== studentId) {
      throw new ForbiddenException('Ban khong co quyen xuat phieu diem nay');
    }

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

    return this.exportStudentAttemptDetailExcel(user, bestAttempt.id);
  }

  async exportGroupResultSheetExcel(
    user: JwtPayload,
    groupId: string,
    filters: SchoolAttemptReportFilters,
  ): Promise<{ buffer: Buffer; fileName: string }> {
    this.ensureAuthenticatedUser(user);
    this.validateDateRange(filters.fromDate, filters.toDate);
    await this.ensureCanAccessStudentGroup(groupId, user);

    const studentGroup = await this.studentGroupRepo.findOne({
      where: { id: groupId },
      relations: ['school'],
    });

    if (!studentGroup) {
      throw new NotFoundException(
        ERROR_MESSAGES.NOT_FOUND_WITH_ID(ENTITY_NAMES.STUDENT_GROUP, groupId),
      );
    }

    const rows = await this.getClassResultSheetRows(groupId, filters);
    const workbook = await this.createClassResultWorkbook();
    this.addClassResultWorksheet(workbook, studentGroup, rows, filters);

    const xlsx = await workbook.xlsx.writeBuffer();
    return {
      buffer: Buffer.from(xlsx),
      fileName: `ket-qua-lop-${this.toSafeFileName(studentGroup.name)}.xlsx`,
    };
  }

  async exportSchoolStatSheetExcel(
    user: JwtPayload,
    schoolId: string,
    filters: SchoolAttemptReportFilters,
  ): Promise<{ buffer: Buffer; fileName: string }> {
    this.ensureAuthenticatedUser(user);
    this.validateDateRange(filters.fromDate, filters.toDate);

    const school = await this.schoolRepo.findOne({ where: { id: schoolId } });
    if (!school) {
      throw new NotFoundException(
        ERROR_MESSAGES.NOT_FOUND_WITH_ID(ENTITY_NAMES.SCHOOL, schoolId),
      );
    }

    this.ensureCanAccessSchoolReport(school, user);

    const rows = await this.getSchoolStatSheetRows(schoolId, filters);
    const workbook = await this.createSchoolStatWorkbook();
    this.addSchoolStatWorksheet(workbook, school, rows, filters);

    const xlsx = await workbook.xlsx.writeBuffer();
    return {
      buffer: Buffer.from(xlsx),
      fileName: `thong-ke-truong-${this.toSafeFileName(school.code)}.xlsx`,
    };
  }

  private ensureAuthenticatedUser(user: JwtPayload): void {
    if (!user?.userId) {
      throw new ForbiddenException(ERROR_MESSAGES.INVALID_TOKEN_STRUCTURE);
    }
  }

  private ensureCanAccessSchoolReport(
    school: SchoolEntity,
    user: JwtPayload,
  ): void {
    if (user.userType === UserType.ADMIN) {
      return;
    }

    if (school.principalUserId === user.userId) {
      return;
    }

    throw new ForbiddenException(
      'Ban khong co quyen xem bao cao cua truong nay',
    );
  }

  private async ensureCanAccessStudentGroup(
    groupId: string,
    user: JwtPayload,
  ): Promise<void> {
    const studentGroup = await this.studentGroupRepo.findOne({
      where: { id: groupId },
    });
    if (!studentGroup) {
      throw new NotFoundException(
        ERROR_MESSAGES.NOT_FOUND_WITH_ID(ENTITY_NAMES.STUDENT_GROUP, groupId),
      );
    }

    if (user.userType === UserType.ADMIN) {
      return;
    }

    const accessibleCount = await this.studentGroupRepo
      .createQueryBuilder('studentGroup')
      .innerJoin('studentGroup.school', 'school')
      .where('studentGroup.id = :groupId', { groupId })
      .andWhere(
        this.canAccessStudentGroupCondition(),
        this.accessParams(user.userId),
      )
      .getCount();

    if (!accessibleCount) {
      throw new ForbiddenException(
        'Bạn không có quyền xem báo cáo của lớp thuộc trường này',
      );
    }
  }

  private async ensureStudentBelongsToGroup(
    groupId: string,
    studentId: string,
  ): Promise<ReportStudentOptionDto> {
    const row = await this.getStudentRowInGroup(groupId, studentId);

    if (!row) {
      const user = await this.userRepo.findOne({ where: { id: studentId } });
      const student = await this.studentRepo.findOne({
        where: { id: studentId },
      });

      if (!user || !student || user.userType !== UserType.STUDENT) {
        throw new NotFoundException(
          ERROR_MESSAGES.NOT_FOUND_WITH_ID(ENTITY_NAMES.STUDENT, studentId),
        );
      }

      throw new NotFoundException('Hoc sinh khong thuoc group duoc chon');
    }

    return row;
  }

  private async getStudentRowsInGroup(
    groupId: string,
  ): Promise<ReportStudentRow[]> {
    return this.studentRepo
      .createQueryBuilder('student')
      .innerJoin(UserEntity, 'user', 'user.id = student.id')
      .leftJoin(
        StudentGroupEntity,
        'studentGroup',
        'studentGroup.id = student.student_group_id',
      )
      .select('user.id', 'id')
      .addSelect('user.full_name', 'fullName')
      .addSelect('user.user_name', 'userName')
      .addSelect('student.code', 'code')
      .addSelect('student.student_group_id', 'studentGroupId')
      .addSelect('studentGroup.name', 'studentGroupName')
      .where('student.student_group_id = :groupId', { groupId })
      .andWhere('user.user_type = :userType', { userType: UserType.STUDENT })
      .orderBy('COALESCE(user.full_name, user.user_name)', 'ASC')
      .getRawMany<ReportStudentRow>();
  }

  private async getStudentRowInGroup(
    groupId: string,
    studentId: string,
  ): Promise<ReportStudentOptionDto | null> {
    const row = await this.studentRepo
      .createQueryBuilder('student')
      .innerJoin(UserEntity, 'user', 'user.id = student.id')
      .leftJoin(
        StudentGroupEntity,
        'studentGroup',
        'studentGroup.id = student.student_group_id',
      )
      .select('user.id', 'id')
      .addSelect('user.full_name', 'fullName')
      .addSelect('user.user_name', 'userName')
      .addSelect('student.code', 'code')
      .addSelect('student.student_group_id', 'studentGroupId')
      .addSelect('studentGroup.name', 'studentGroupName')
      .where('student.student_group_id = :groupId', { groupId })
      .andWhere('user.id = :studentId', { studentId })
      .andWhere('user.user_type = :userType', { userType: UserType.STUDENT })
      .getRawOne<ReportStudentRow>();

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      fullName: row.fullName,
      userName: row.userName,
      code: row.code,
      studentGroupId: row.studentGroupId,
      studentGroupName: row.studentGroupName,
    };
  }

  private async getSchoolAttemptReportRows(
    schoolId: string,
    filters: SchoolAttemptReportFilters,
  ): Promise<SchoolAttemptReportRow[]> {
    const attemptJoinConditions = ['attempt.student_id = student.id'];
    const params: Record<string, string> = {
      schoolId,
      userType: UserType.STUDENT,
    };

    if (filters.examSetId) {
      attemptJoinConditions.push('attempt.exam_set_id = :examSetId');
      params.examSetId = filters.examSetId;
    }

    if (filters.questionBankId) {
      attemptJoinConditions.push('attempt.question_bank_id = :questionBankId');
      params.questionBankId = filters.questionBankId;
    }

    if (filters.fromDate) {
      attemptJoinConditions.push('DATE(attempt.started_at) >= :fromDate');
      params.fromDate = filters.fromDate;
    }

    if (filters.toDate) {
      attemptJoinConditions.push('DATE(attempt.started_at) <= :toDate');
      params.toDate = filters.toDate;
    }

    return this.studentRepo
      .createQueryBuilder('student')
      .innerJoin(UserEntity, 'user', 'user.id = student.id')
      .innerJoin(
        StudentGroupEntity,
        'studentGroup',
        'studentGroup.id = student.student_group_id',
      )
      .leftJoin(AttemptEntity, 'attempt', attemptJoinConditions.join(' AND '))
      .select('student.id', 'studentId')
      .addSelect('user.full_name', 'fullName')
      .addSelect('user.user_name', 'userName')
      .addSelect('student.code', 'studentCode')
      .addSelect('studentGroup.id', 'studentGroupId')
      .addSelect('studentGroup.name', 'studentGroupName')
      .addSelect('COUNT(attempt.id)', 'totalAttempts')
      .addSelect('AVG(attempt.score)', 'averageScore')
      .addSelect('MAX(attempt.score)', 'highestScore')
      .addSelect(
        'MAX(COALESCE(attempt.submitted_at, attempt.started_at))',
        'latestAttemptAt',
      )
      .where('studentGroup.schoolId = :schoolId')
      .andWhere('user.user_type = :userType')
      .setParameters(params)
      .groupBy('student.id')
      .addGroupBy('user.full_name')
      .addGroupBy('user.user_name')
      .addGroupBy('student.code')
      .addGroupBy('studentGroup.id')
      .addGroupBy('studentGroup.name')
      .orderBy('studentGroup.name', 'ASC')
      .addOrderBy('COALESCE(user.full_name, user.user_name)', 'ASC')
      .getRawMany<SchoolAttemptReportRow>();
  }

  private async getClassAttemptScoreRows(
    groupId: string,
    filters: SchoolAttemptReportFilters,
  ): Promise<ClassAttemptScoreExportRow[]> {
    const attemptJoinConditions = ['attempt.student_id = student.id'];
    const params: Record<string, string> = {
      groupId,
      userType: UserType.STUDENT,
    };

    if (filters.examSetId) {
      attemptJoinConditions.push('attempt.exam_set_id = :examSetId');
      params.examSetId = filters.examSetId;
    }

    if (filters.questionBankId) {
      attemptJoinConditions.push('attempt.question_bank_id = :questionBankId');
      params.questionBankId = filters.questionBankId;
    }

    if (filters.fromDate) {
      attemptJoinConditions.push('DATE(attempt.started_at) >= :fromDate');
      params.fromDate = filters.fromDate;
    }

    if (filters.toDate) {
      attemptJoinConditions.push('DATE(attempt.started_at) <= :toDate');
      params.toDate = filters.toDate;
    }

    return this.studentRepo
      .createQueryBuilder('student')
      .innerJoin(UserEntity, 'user', 'user.id = student.id')
      .leftJoin(AttemptEntity, 'attempt', attemptJoinConditions.join(' AND '))
      .leftJoin('attempt.examSet', 'examSet')
      .leftJoin('attempt.questionBank', 'questionBank')
      .select('student.id', 'studentId')
      .addSelect('student.code', 'studentCode')
      .addSelect('user.full_name', 'fullName')
      .addSelect('user.user_name', 'userName')
      .addSelect('attempt.id', 'attemptId')
      .addSelect('attempt.examSetId', 'examSetId')
      .addSelect('examSet.name', 'examSetName')
      .addSelect('attempt.questionBankId', 'questionBankId')
      .addSelect('questionBank.name', 'questionBankName')
      .addSelect('attempt.status', 'status')
      .addSelect('attempt.started_at', 'startedAt')
      .addSelect('attempt.submitted_at', 'submittedAt')
      .addSelect('attempt.score', 'score')
      .where('student.student_group_id = :groupId')
      .andWhere('user.user_type = :userType')
      .setParameters(params)
      .orderBy('COALESCE(user.full_name, user.user_name)', 'ASC')
      .addOrderBy('attempt.started_at', 'DESC')
      .getRawMany<ClassAttemptScoreExportRow>();
  }

  private addClassAttemptScoreWorksheet(
    workbook: Workbook,
    studentGroup: StudentGroupEntity,
    rows: ClassAttemptScoreExportRow[],
  ): void {
    const worksheet = workbook.addWorksheet(
      this.toWorksheetName(studentGroup.name),
    );

    worksheet.columns = [
      { header: 'STT', key: 'index', width: 8 },
      { header: 'Ma hoc sinh', key: 'studentCode', width: 16 },
      { header: 'Ho ten', key: 'fullName', width: 28 },
      { header: 'Tai khoan', key: 'userName', width: 22 },
      { header: 'Bo de', key: 'examSetName', width: 28 },
      { header: 'De thi', key: 'questionBankName', width: 32 },
      { header: 'Trang thai', key: 'status', width: 16 },
      { header: 'Bat dau', key: 'startedAt', width: 22 },
      { header: 'Nop bai', key: 'submittedAt', width: 22 },
      { header: 'Diem', key: 'score', width: 12 },
    ];

    worksheet.insertRows(1, [
      [`Lop: ${studentGroup.name}`],
      [`Truong: ${studentGroup.school?.name ?? ''}`],
      [`Ngay xuat: ${this.formatDateTime(new Date())}`],
      [],
    ]);

    const headerRow = worksheet.getRow(5);
    headerRow.font = { bold: true };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    rows.forEach((row, index) => {
      worksheet.addRow({
        index: index + 1,
        studentCode: row.studentCode,
        fullName: row.fullName ?? '',
        userName: row.userName,
        examSetName: row.examSetName ?? '',
        questionBankName: row.questionBankName ?? '',
        status: this.formatAttemptStatusForExport(row.status),
        startedAt: row.startedAt ? this.formatDateTime(row.startedAt) : '',
        submittedAt: row.submittedAt
          ? this.formatDateTime(row.submittedAt)
          : '',
        score: this.toNullableNumber(row.score) ?? '',
      });
    });

    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });
    });
  }

  private async getStudentAttemptDetailContext(
    attemptId: string,
  ): Promise<StudentAttemptDetailContext | null> {
    const row = await this.attemptRepo
      .createQueryBuilder('attempt')
      .innerJoin('attempt.student', 'student')
      .innerJoin(UserEntity, 'user', 'user.id = student.id')
      .leftJoin('student.studentGroup', 'studentGroup')
      .leftJoin('studentGroup.school', 'school')
      .leftJoin('attempt.examSet', 'examSet')
      .leftJoin('attempt.questionBank', 'questionBank')
      .select('attempt.id', 'attemptId')
      .addSelect('attempt.score', 'score')
      .addSelect('attempt.started_at', 'startedAt')
      .addSelect('attempt.submitted_at', 'submittedAt')
      .addSelect('student.id', 'studentId')
      .addSelect('student.code', 'studentCode')
      .addSelect('user.full_name', 'studentFullName')
      .addSelect('user.user_name', 'studentUserName')
      .addSelect('studentGroup.id', 'groupId')
      .addSelect('studentGroup.name', 'groupName')
      .addSelect('school.name', 'schoolName')
      .addSelect('examSet.name', 'examSetName')
      .addSelect('questionBank.name', 'questionBankName')
      .addSelect('questionBank.id', 'questionBankId')
      .where('attempt.id = :attemptId', { attemptId })
      .getRawOne<StudentAttemptDetailContext>();

    return row ?? null;
  }

  private async getStudentAttemptDetailRows(
    questionBankId: string,
    attemptId: string,
  ): Promise<StudentAttemptDetailRow[]> {
    const rows = await this.questionBankQuestionRepo
      .createQueryBuilder('qbq')
      .leftJoin(
        StudentAnswerEntity,
        'studentAnswer',
        'studentAnswer.question_id = qbq.question_id AND studentAnswer.attempt_id = :attemptId',
        { attemptId },
      )
      .select('qbq.order_no', 'orderNo')
      .addSelect('studentAnswer.is_correct', 'isCorrect')
      .addSelect('studentAnswer.points_earned', 'pointsEarned')
      .where('qbq.question_bank_id = :questionBankId', { questionBankId })
      .orderBy('qbq.order_no', 'ASC')
      .getRawMany<{
        orderNo: string;
        isCorrect: boolean | null;
        pointsEarned: string | null;
      }>();

    return rows.map((row) => ({
      orderNo: Number(row.orderNo),
      isCorrect: row.isCorrect === null ? null : Boolean(row.isCorrect),
      pointsEarned: row.pointsEarned,
    }));
  }

  private async getStudentAttemptScoreStats(
    studentId: string,
    questionBankId: string,
  ): Promise<StudentAttemptScoreStats> {
    const row = await this.attemptRepo
      .createQueryBuilder('attempt')
      .select('COUNT(attempt.id)', 'attemptCount')
      .addSelect('MAX(attempt.score)', 'highestScore')
      .addSelect('MIN(attempt.score)', 'lowestScore')
      .addSelect('AVG(attempt.score)', 'averageScore')
      .where('attempt.student_id = :studentId', { studentId })
      .andWhere('attempt.question_bank_id = :questionBankId', {
        questionBankId,
      })
      .andWhere('attempt.submitted_at IS NOT NULL')
      .getRawOne<{
        attemptCount: string;
        highestScore: string | null;
        lowestScore: string | null;
        averageScore: string | null;
      }>();

    return {
      attemptCount: Number(row?.attemptCount ?? 0),
      highestScore: this.toNullableNumber(row?.highestScore ?? null),
      lowestScore: this.toNullableNumber(row?.lowestScore ?? null),
      averageScore: this.toNullableNumber(row?.averageScore ?? null),
    };
  }

  private async getClassResultSheetRows(
    groupId: string,
    filters: SchoolAttemptReportFilters,
  ): Promise<ClassSheetRow[]> {
    const rawRows = await this.getClassSheetRawRows(groupId, filters);
    const latestRows = new Map<string, ClassSheetRawRow>();

    for (const row of rawRows) {
      if (!latestRows.has(row.studentId)) {
        latestRows.set(row.studentId, row);
      }
    }

    const attemptIds = [...latestRows.values()]
      .map((row) => row.attemptId)
      .filter((attemptId): attemptId is string => Boolean(attemptId));

    const correctCounts = await this.getCorrectCountsByAttemptIds(attemptIds);

    return [...latestRows.values()].map((row) => {
      const score = this.toNullableNumber(row.score);
      return {
        studentId: row.studentId,
        studentCode: row.studentCode,
        fullName: row.fullName ?? row.userName,
        subjectName: row.subjectName ?? row.questionBankName ?? '',
        correctCount: row.attemptId
          ? (correctCounts.get(row.attemptId) ?? 0)
          : 0,
        score,
        resultLabel:
          score === null ? 'Chua thi' : score >= 5 ? 'Dat' : 'Chua dat',
        startedAt: row.startedAt ? new Date(row.startedAt) : null,
      };
    });
  }

  private async getClassSheetRawRows(
    groupId: string,
    filters: SchoolAttemptReportFilters,
  ): Promise<ClassSheetRawRow[]> {
    const attemptJoinConditions = ['attempt.student_id = student.id'];
    const params: Record<string, string> = {
      groupId,
      userType: UserType.STUDENT,
    };

    if (filters.examSetId) {
      attemptJoinConditions.push('attempt.exam_set_id = :examSetId');
      params.examSetId = filters.examSetId;
    }

    if (filters.questionBankId) {
      attemptJoinConditions.push('attempt.question_bank_id = :questionBankId');
      params.questionBankId = filters.questionBankId;
    }

    if (filters.fromDate) {
      attemptJoinConditions.push('DATE(attempt.started_at) >= :fromDate');
      params.fromDate = filters.fromDate;
    }

    if (filters.toDate) {
      attemptJoinConditions.push('DATE(attempt.started_at) <= :toDate');
      params.toDate = filters.toDate;
    }

    return this.studentRepo
      .createQueryBuilder('student')
      .innerJoin(UserEntity, 'user', 'user.id = student.id')
      .leftJoin(AttemptEntity, 'attempt', attemptJoinConditions.join(' AND '))
      .leftJoin('attempt.examSet', 'examSet')
      .leftJoin('attempt.questionBank', 'questionBank')
      .leftJoin('questionBank.class', 'questionBankClass')
      .leftJoin(
        'subject',
        'subject',
        'subject.id = questionBankClass.subject_id',
      )
      .select('student.id', 'studentId')
      .addSelect('student.code', 'studentCode')
      .addSelect('user.full_name', 'fullName')
      .addSelect('user.user_name', 'userName')
      .addSelect('attempt.id', 'attemptId')
      .addSelect('examSet.name', 'examSetName')
      .addSelect('questionBank.name', 'questionBankName')
      .addSelect('subject.name', 'subjectName')
      .addSelect('attempt.started_at', 'startedAt')
      .addSelect('attempt.submitted_at', 'submittedAt')
      .addSelect('attempt.score', 'score')
      .where('student.student_group_id = :groupId')
      .andWhere('user.user_type = :userType')
      .setParameters(params)
      .orderBy('COALESCE(user.full_name, user.user_name)', 'ASC')
      .addOrderBy('attempt.started_at', 'DESC')
      .getRawMany<ClassSheetRawRow>();
  }

  private async getCorrectCountsByAttemptIds(
    attemptIds: string[],
  ): Promise<Map<string, number>> {
    if (!attemptIds.length) {
      return new Map();
    }

    const rows = await this.studentAnswerRepo
      .createQueryBuilder('studentAnswer')
      .select('studentAnswer.attempt_id', 'attemptId')
      .addSelect('COUNT(*)', 'correctCount')
      .where('studentAnswer.attempt_id IN (:...attemptIds)', { attemptIds })
      .andWhere('studentAnswer.is_correct = true')
      .groupBy('studentAnswer.attempt_id')
      .getRawMany<{ attemptId: string; correctCount: string }>();

    return new Map(
      rows.map((row) => [row.attemptId, Number(row.correctCount) || 0]),
    );
  }

  private async getSchoolStatSheetRows(
    schoolId: string,
    filters: SchoolAttemptReportFilters,
  ): Promise<SchoolStatRow[]> {
    const rawRows = await this.getSchoolStatRawRows(schoolId, filters);
    const latestRows = new Map<string, SchoolStatRawRow>();

    for (const row of rawRows) {
      if (!latestRows.has(row.studentId)) {
        latestRows.set(row.studentId, row);
      }
    }

    const statsByGroup = new Map<string, SchoolStatRow>();

    for (const row of latestRows.values()) {
      const current =
        statsByGroup.get(row.studentGroupId) ??
        ({
          groupId: row.studentGroupId,
          groupName: row.studentGroupName,
          totalStudents: 0,
          attemptedStudents: 0,
          absentStudents: 0,
          highestScore: null,
          lowestScore: null,
          underFiveCount: 0,
          averageScore: null,
          passRate: 0,
          ranking: null,
          assessment: '',
        } satisfies SchoolStatRow);

      current.totalStudents += 1;
      const score = this.toNullableNumber(row.score);
      if (row.attemptId && score !== null) {
        current.attemptedStudents += 1;
        current.highestScore =
          current.highestScore === null
            ? score
            : Math.max(current.highestScore, score);
        current.lowestScore =
          current.lowestScore === null
            ? score
            : Math.min(current.lowestScore, score);
        if (score < 5) {
          current.underFiveCount += 1;
        }
        current.averageScore =
          current.averageScore === null ? score : current.averageScore + score;
      }

      statsByGroup.set(row.studentGroupId, current);
    }

    const rows = [...statsByGroup.values()].map((row) => {
      const averageScore =
        row.attemptedStudents > 0 && row.averageScore !== null
          ? row.averageScore / row.attemptedStudents
          : null;
      const absentStudents = row.totalStudents - row.attemptedStudents;
      const passRate =
        row.attemptedStudents > 0
          ? ((row.attemptedStudents - row.underFiveCount) /
              row.attemptedStudents) *
            100
          : 0;

      return {
        ...row,
        averageScore,
        absentStudents,
        passRate,
        assessment: this.getAssessmentLabel(averageScore),
      };
    });

    const ranked = [...rows]
      .sort((a, b) => {
        const aScore = a.averageScore ?? -1;
        const bScore = b.averageScore ?? -1;
        if (bScore !== aScore) {
          return bScore - aScore;
        }
        return a.groupName.localeCompare(b.groupName);
      })
      .map((row, index) => ({
        ...row,
        ranking: row.averageScore === null ? null : index + 1,
      }));

    return ranked.sort((a, b) => a.groupName.localeCompare(b.groupName));
  }

  private async getSchoolStatRawRows(
    schoolId: string,
    filters: SchoolAttemptReportFilters,
  ): Promise<SchoolStatRawRow[]> {
    const attemptJoinConditions = ['attempt.student_id = student.id'];
    const params: Record<string, string> = {
      schoolId,
      userType: UserType.STUDENT,
    };

    if (filters.examSetId) {
      attemptJoinConditions.push('attempt.exam_set_id = :examSetId');
      params.examSetId = filters.examSetId;
    }

    if (filters.questionBankId) {
      attemptJoinConditions.push('attempt.question_bank_id = :questionBankId');
      params.questionBankId = filters.questionBankId;
    }

    if (filters.fromDate) {
      attemptJoinConditions.push('DATE(attempt.started_at) >= :fromDate');
      params.fromDate = filters.fromDate;
    }

    if (filters.toDate) {
      attemptJoinConditions.push('DATE(attempt.started_at) <= :toDate');
      params.toDate = filters.toDate;
    }

    return this.studentRepo
      .createQueryBuilder('student')
      .innerJoin(UserEntity, 'user', 'user.id = student.id')
      .innerJoin(
        StudentGroupEntity,
        'studentGroup',
        'studentGroup.id = student.student_group_id',
      )
      .leftJoin(AttemptEntity, 'attempt', attemptJoinConditions.join(' AND '))
      .select('student.id', 'studentId')
      .addSelect('student.code', 'studentCode')
      .addSelect('studentGroup.id', 'studentGroupId')
      .addSelect('studentGroup.name', 'studentGroupName')
      .addSelect('user.full_name', 'fullName')
      .addSelect('user.user_name', 'userName')
      .addSelect('attempt.id', 'attemptId')
      .addSelect('attempt.score', 'score')
      .addSelect('attempt.started_at', 'startedAt')
      .where('studentGroup.schoolId = :schoolId')
      .andWhere('user.user_type = :userType')
      .setParameters(params)
      .orderBy('studentGroup.name', 'ASC')
      .addOrderBy('COALESCE(user.full_name, user.user_name)', 'ASC')
      .addOrderBy('attempt.started_at', 'DESC')
      .getRawMany<SchoolStatRawRow>();
  }

  private addStudentDetailWorksheet(
    workbook: Workbook,
    context: StudentAttemptDetailContext,
    rows: StudentAttemptDetailRow[],
    stats: StudentAttemptScoreStats,
  ): void {
    const worksheet =
      workbook.getWorksheet('CHI TIẾT HS') ??
      workbook.addWorksheet('CHI TIẾT HS');

    if (!worksheet.columns.length) {
      this.setupSheetColumns(worksheet, [14, 14, 14, 22, 22, 22]);
    }

    worksheet.getCell('A1').value =
      worksheet.getCell('A1').value ?? '    CÔNG TY CỔ PHẦN GIÁO DỤC';
    worksheet.getCell('A2').value =
      worksheet.getCell('A2').value ?? 'KHOA HỌC CÔNG NGHỆ ICHI SKILL';
    worksheet.getCell('F1').value =
      worksheet.getCell('F1').value ?? 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM';
    worksheet.getCell('F2').value =
      worksheet.getCell('F2').value ?? 'Độc lập - Tự do - Hạnh Phúc';

    worksheet.getCell('D3').value =
      worksheet.getCell('D3').value ?? 'KỲ THI ĐÁNH GIÁ HỌC KỲ II';
    worksheet.getCell('E3').value =
      `NĂM HỌC: ${new Date().getFullYear()} - ${new Date().getFullYear() + 1}`;

    worksheet.getCell('C4').value =
      worksheet.getCell('C4').value ?? 'PHIẾU ĐIỂM HỌC SINH';
    worksheet.getCell('C5').value = `TRƯỜNG: ${context.schoolName ?? ''}`;
    worksheet.getCell('C6').value = `LỚP: ${context.groupName ?? ''}`;
    worksheet.getCell('C7').value =
      `HỌC SINH: ${context.studentFullName ?? context.studentUserName}`;

    worksheet.getCell('A9').value = 'CÂU';
    worksheet.getCell('B9').value = 'ĐÚNG';
    worksheet.getCell('C9').value = 'SAI';

    const templateQuestionCapacity = 6;
    if (rows.length > templateQuestionCapacity) {
      worksheet.spliceRows(
        16,
        0,
        ...Array.from(
          { length: rows.length - templateQuestionCapacity },
          () => [],
        ),
      );
    }

    for (
      let rowIndex = 10;
      rowIndex <= 9 + Math.max(rows.length, templateQuestionCapacity);
      rowIndex += 1
    ) {
      for (let columnIndex = 1; columnIndex <= 3; columnIndex += 1) {
        worksheet.getRow(rowIndex).getCell(columnIndex).value = null;
      }
    }

    let correctCount = 0;
    let wrongCount = 0;

    rows.forEach((row, index) => {
      const excelRow = worksheet.getRow(10 + index);
      excelRow.getCell(1).value = row.orderNo;
      excelRow.getCell(2).value = row.isCorrect === true ? 'x' : '';
      excelRow.getCell(3).value = row.isCorrect === false ? 'x' : '';
      if (row.isCorrect === true) {
        correctCount += 1;
      } else if (row.isCorrect === false) {
        wrongCount += 1;
      }
      this.styleStudentDetailRow(excelRow);
    });

    const summaryRowIndex =
      17 + Math.max(0, rows.length - templateQuestionCapacity);
    const scoreRowIndex = summaryRowIndex + 1;
    const dateRowIndex = summaryRowIndex + 2;
    const noteRowIndex = summaryRowIndex + 4;
    const highestScoreRowIndex = summaryRowIndex + 5;
    const lowestScoreRowIndex = summaryRowIndex + 6;
    const averageScoreRowIndex = summaryRowIndex + 7;

    worksheet.getCell(`A${summaryRowIndex}`).value = 'TỔNG';
    worksheet.getCell(`B${summaryRowIndex}`).value = correctCount;
    worksheet.getCell(`C${summaryRowIndex}`).value = wrongCount;
    this.styleStudentDetailRow(worksheet.getRow(summaryRowIndex), true);
    this.clearBorders(worksheet, 9, summaryRowIndex, 3);
    this.clearFill(worksheet, 1, Math.max(35, averageScoreRowIndex), 8);
    this.clearUnusedBorders(
      worksheet,
      1,
      Math.max(35, averageScoreRowIndex),
      8,
    );

    worksheet.getCell(`B${scoreRowIndex}`).value =
      `ĐIỂM: ${this.formatNullableScore(context.score)}`;
    worksheet.getCell(`B${dateRowIndex}`).value = `Ngày kiểm tra: ${
      context.submittedAt
        ? this.formatDate(new Date(context.submittedAt))
        : this.formatDate(context.startedAt)
    }`;
    worksheet.getCell(`D${scoreRowIndex}`).value =
      this.formatCompletionDuration(context.startedAt, context.submittedAt);
    worksheet.getCell(`A${noteRowIndex}`).value = 'Ghi chú:';
    worksheet.getCell(`B${noteRowIndex}`).value =
      `Số lần làm bài: ${stats.attemptCount}`;
    worksheet.getCell(`B${highestScoreRowIndex}`).value =
      `Điểm số cao nhất: ${this.formatNullableScore(stats.highestScore)}`;
    worksheet.getCell(`B${lowestScoreRowIndex}`).value =
      `Điểm số thấp nhất: ${this.formatNullableScore(stats.lowestScore)}`;
    worksheet.getCell(`B${averageScoreRowIndex}`).value =
      `Trung bình điểm thi: ${this.formatNullableScore(stats.averageScore)}`;
    this.clearFill(worksheet, 1, Math.max(35, averageScoreRowIndex), 8);
    this.clearUnusedBorders(
      worksheet,
      1,
      Math.max(35, averageScoreRowIndex),
      8,
    );
  }

  private addClassResultWorksheet(
    workbook: Workbook,
    studentGroup: StudentGroupEntity,
    rows: ClassSheetRow[],
    filters: SchoolAttemptReportFilters,
  ): void {
    const worksheet =
      workbook.getWorksheet('KẾT QUẢ LỚP') ??
      workbook.addWorksheet('KẾT QUẢ LỚP');

    if (!worksheet.columns.length) {
      this.setupSheetColumns(worksheet, [8, 28, 18, 14, 14, 20, 26, 20, 16]);
    }

    const dataWorksheet = workbook.getWorksheet('data');
    if (dataWorksheet) {
      dataWorksheet.getCell('B1').value = studentGroup.school?.name ?? '';
      dataWorksheet.getCell('B2').value = studentGroup.name;
    }

    worksheet.getCell('A4').value = [
      'KỲ THI ĐÁNH GIÁ HỌC KỲ II - NĂM HỌC: 2025 2026',
      'BẢNG ĐIỂM HỌC SINH K6',
      `TRƯỜNG: ${studentGroup.school?.name ?? ''}`,
      `LỚP: ${studentGroup.name}`,
    ]
      .filter(Boolean)
      .join('\n');

    const dataStartRow = 10;
    const templateRow = worksheet.getRow(dataStartRow);
    rows.forEach((row, index) => {
      const rowIndex = dataStartRow + index;
      const excelRow = worksheet.getRow(rowIndex);
      if (rowIndex !== dataStartRow) {
        this.copyRowStyle(templateRow, excelRow, 10);
        worksheet.mergeCells(rowIndex, 9, rowIndex, 10);
      }
      excelRow.getCell(1).value = index + 1;
      excelRow.getCell(2).value = row.fullName;
      excelRow.getCell(3).value = row.subjectName;
      excelRow.getCell(4).value = row.correctCount;
      excelRow.getCell(5).value =
        row.score === null ? '' : Number(row.score.toFixed(2));
      excelRow.getCell(6).value = row.resultLabel;
      excelRow.getCell(7).value = row.startedAt
        ? this.formatDateTime(row.startedAt)
        : '';
      excelRow.getCell(8).value = '';
      excelRow.getCell(9).value = '';
      excelRow.getCell(10).value = '';
      this.styleDataRow(excelRow);
      excelRow.commit();
    });

    if (rows.length === 0) {
      for (let col = 1; col <= 10; col += 1) {
        templateRow.getCell(col).value = '';
      }
    }

    this.applyTableBorder(
      worksheet,
      9,
      Math.max(dataStartRow, dataStartRow + rows.length - 1),
      10,
    );
  }

  private addSchoolStatWorksheet(
    workbook: Workbook,
    school: SchoolEntity,
    rows: SchoolStatRow[],
    filters: SchoolAttemptReportFilters,
  ): void {
    const worksheet =
      workbook.getWorksheet('Thống kê TRƯỜNG.KHU VỰC') ??
      workbook.addWorksheet('Thống kê TRƯỜNG.KHU VỰC');

    if (!worksheet.columns.length) {
      this.setupSheetColumns(
        worksheet,
        [22, 12, 12, 12, 12, 12, 16, 12, 14, 10, 16, 16],
      );
    }

    const dataWorksheet = workbook.getWorksheet('data');
    if (dataWorksheet) {
      dataWorksheet.getCell('B1').value = school.name;
    }

    worksheet.getCell('A4').value = [
      'KỲ THI ĐÁNH GIÁ HỌC KỲ II - NĂM HỌC: 2025 2026',
      'BẢNG THỐNG KÊ ĐIỂM SỐ',
      `TRƯỜNG: ${school.name}`,
      'CHƯƠNG TRÌNH GIÁO DỤC : KỸ NĂNG SỐNG/STEM/CÔNG DÂN SỐ ICHI SKILL',
    ].join('\n');

    const dataStartRow = 9;
    const templateRow = worksheet.getRow(dataStartRow);
    rows.forEach((row, index) => {
      const rowIndex = dataStartRow + index;
      const excelRow = worksheet.getRow(rowIndex);
      if (rowIndex !== dataStartRow) {
        this.copyRowStyle(templateRow, excelRow, 12);
      }
      excelRow.getCell(1).value = row.groupName;
      excelRow.getCell(2).value = row.totalStudents;
      excelRow.getCell(3).value = row.attemptedStudents;
      excelRow.getCell(4).value = row.absentStudents;
      excelRow.getCell(5).value =
        row.highestScore === null ? '' : Number(row.highestScore.toFixed(2));
      excelRow.getCell(6).value =
        row.lowestScore === null ? '' : Number(row.lowestScore.toFixed(2));
      excelRow.getCell(7).value = row.underFiveCount;
      excelRow.getCell(8).value =
        row.averageScore === null ? '' : Number(row.averageScore.toFixed(2));
      excelRow.getCell(9).value = Number(row.passRate.toFixed(2));
      excelRow.getCell(10).value = row.ranking ?? '';
      excelRow.getCell(11).value = row.assessment;
      excelRow.getCell(12).value = '';
      this.styleDataRow(excelRow);
      excelRow.commit();
    });

    if (rows.length === 0) {
      for (let col = 1; col <= 12; col += 1) {
        templateRow.getCell(col).value = '';
      }
    }

    this.applyTableBorder(
      worksheet,
      8,
      Math.max(dataStartRow, dataStartRow + rows.length - 1),
      12,
    );
  }

  private setupSheetColumns(worksheet: Worksheet, widths: number[]): void {
    worksheet.columns = widths.map((width) => ({ width }));
  }

  private styleTableHeader(row: Row): void {
    row.font = { bold: true };
    row.alignment = {
      vertical: 'middle',
      horizontal: 'center',
      wrapText: true,
    };
    row.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'D9EAF7' },
      };
    });
  }

  private styleDataRow(row: Row): void {
    row.alignment = {
      vertical: 'middle',
      horizontal: 'center',
      wrapText: true,
    };
  }

  private copyRowStyle(source: Row, target: Row, totalColumns: number): void {
    target.height = source.height;
    for (let col = 1; col <= totalColumns; col += 1) {
      target.getCell(col).style = JSON.parse(
        JSON.stringify(source.getCell(col).style ?? {}),
      );
    }
  }

  private styleStudentDetailRow(row: Row, bold = false): void {
    if (bold) {
      row.font = { bold: true };
    }
    row.alignment = {
      vertical: 'middle',
      horizontal: 'center',
      wrapText: true,
    };
  }

  private clearFill(
    worksheet: Worksheet,
    fromRow: number,
    toRow: number,
    totalColumns: number,
  ): void {
    for (let rowIndex = fromRow; rowIndex <= toRow; rowIndex += 1) {
      const row = worksheet.getRow(rowIndex);
      for (let col = 1; col <= totalColumns; col += 1) {
        row.getCell(col).fill = {
          type: 'pattern',
          pattern: 'none',
        };
      }
    }
  }

  private clearUnusedBorders(
    worksheet: Worksheet,
    fromRow: number,
    toRow: number,
    totalColumns: number,
  ): void {
    for (let rowIndex = fromRow; rowIndex <= toRow; rowIndex += 1) {
      const row = worksheet.getRow(rowIndex);
      for (let col = 1; col <= totalColumns; col += 1) {
        const cell = row.getCell(col);
        const hasValue =
          cell.value !== null && cell.value !== undefined && cell.value !== '';
        if (!hasValue) {
          cell.border = {};
        }
      }
    }
  }

  private clearBorders(
    worksheet: Worksheet,
    fromRow: number,
    toRow: number,
    totalColumns: number,
  ): void {
    for (let rowIndex = fromRow; rowIndex <= toRow; rowIndex += 1) {
      const row = worksheet.getRow(rowIndex);
      for (let col = 1; col <= totalColumns; col += 1) {
        row.getCell(col).border = {};
      }
    }
  }

  private applyTableBorder(
    worksheet: Worksheet,
    fromRow: number,
    toRow: number,
    totalColumns: number,
  ): void {
    for (let rowIndex = fromRow; rowIndex <= toRow; rowIndex += 1) {
      const row = worksheet.getRow(rowIndex);
      for (let col = 1; col <= totalColumns; col += 1) {
        const cell = row.getCell(col);
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      }
    }
  }

  private getAssessmentLabel(score: number | null): string {
    if (score === null) {
      return 'Chua co du lieu';
    }
    if (score >= 8) {
      return 'Tot';
    }
    if (score >= 6.5) {
      return 'Kha';
    }
    if (score >= 5) {
      return 'Dat';
    }
    return 'Can ho tro';
  }

  private buildAttemptScope(
    studentId: string,
    fromDate?: string,
    toDate?: string,
  ) {
    const qb = this.attemptRepo
      .createQueryBuilder('attempt')
      .where('attempt.studentId = :studentId', { studentId });

    if (fromDate) {
      qb.andWhere('DATE(attempt.started_at) >= :fromDate', { fromDate });
    }

    if (toDate) {
      qb.andWhere('DATE(attempt.started_at) <= :toDate', { toDate });
    }

    return qb;
  }

  private validateDateRange(fromDate?: string, toDate?: string): void {
    if (fromDate) {
      this.validateDate(fromDate, 'fromDate');
    }

    if (toDate) {
      this.validateDate(toDate, 'toDate');
    }

    if (fromDate && toDate && fromDate > toDate) {
      throw new BadRequestException('fromDate phai nho hon hoac bang toDate');
    }
  }

  private validateDate(value: string, fieldName: string): void {
    const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!isoDateRegex.test(value)) {
      throw new BadRequestException(
        `${fieldName} phai theo dinh dang YYYY-MM-DD`,
      );
    }
  }

  private toNullableNumber(
    value: string | number | null | undefined,
  ): number | null {
    if (value === null || value === undefined) {
      return null;
    }

    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }

  private async buildSchoolAttemptReportPdf(
    school: SchoolEntity,
    rows: SchoolAttemptReportRow[],
    filters: SchoolAttemptReportFilters,
  ): Promise<Buffer> {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const pageSize: [number, number] = [841.89, 595.28];
    const margin = 36;
    const rowHeight = 22;
    const tableTopGap = 18;
    const columns = [
      { label: 'Lop', width: 105 },
      { label: 'Ma HS', width: 70 },
      { label: 'Hoc sinh', width: 160 },
      { label: 'Tai khoan', width: 115 },
      { label: 'Lan lam', width: 58 },
      { label: 'TB', width: 55 },
      { label: 'Cao nhat', width: 65 },
      { label: 'Gan nhat', width: 95 },
    ];
    const tableWidth = columns.reduce((sum, col) => sum + col.width, 0);

    let page = pdfDoc.addPage(pageSize);
    let y = page.getHeight() - margin;

    const drawText = (
      targetPage: PDFPage,
      text: string,
      x: number,
      textY: number,
      size: number,
      targetFont: PDFFont = font,
      maxWidth?: number,
    ) => {
      targetPage.drawText(
        this.truncateForWidth(targetFont, this.toPdfText(text), size, maxWidth),
        {
          x,
          y: textY,
          size,
          font: targetFont,
          color: rgb(0.12, 0.12, 0.12),
        },
      );
    };

    const addPage = () => {
      page = pdfDoc.addPage(pageSize);
      y = page.getHeight() - margin;
      drawTableHeader();
    };

    const drawTableHeader = () => {
      let x = margin;
      page.drawRectangle({
        x,
        y: y - rowHeight + 5,
        width: tableWidth,
        height: rowHeight,
        color: rgb(0.92, 0.94, 0.97),
      });

      for (const col of columns) {
        drawText(page, col.label, x + 5, y - 12, 9, boldFont, col.width - 10);
        x += col.width;
      }
      y -= rowHeight;
    };

    drawText(
      page,
      'BAO CAO DIEM TONG HOP THEO TRUONG',
      margin,
      y,
      16,
      boldFont,
    );
    y -= 24;
    drawText(page, `Truong: ${school.name} (${school.code})`, margin, y, 11);
    y -= 16;
    drawText(
      page,
      `Ngay xuat: ${this.formatDateTime(new Date())}`,
      margin,
      y,
      10,
    );
    y -= 16;
    drawText(page, this.formatReportFilters(filters), margin, y, 10);
    y -= tableTopGap;

    drawTableHeader();

    if (rows.length === 0) {
      drawText(
        page,
        'Khong co du lieu hoc sinh trong truong nay.',
        margin,
        y - 12,
        10,
      );
    }

    for (const row of rows) {
      if (y < margin + rowHeight) {
        addPage();
      }

      let x = margin;
      const values = [
        row.studentGroupName,
        row.studentCode,
        row.fullName ?? row.userName,
        row.userName,
        String(Number(row.totalAttempts) || 0),
        this.formatNullableScore(row.averageScore),
        this.formatNullableScore(row.highestScore),
        row.latestAttemptAt ? this.formatDate(row.latestAttemptAt) : '-',
      ];

      page.drawLine({
        start: { x: margin, y: y + 4 },
        end: { x: margin + tableWidth, y: y + 4 },
        thickness: 0.5,
        color: rgb(0.86, 0.86, 0.86),
      });

      for (let i = 0; i < columns.length; i += 1) {
        drawText(
          page,
          values[i],
          x + 5,
          y - 11,
          8.5,
          font,
          columns[i].width - 10,
        );
        x += columns[i].width;
      }

      y -= rowHeight;
    }

    const totalStudents = rows.length;
    const studentsWithAttempts = rows.filter(
      (row) => Number(row.totalAttempts) > 0,
    ).length;
    const totalAttempts = rows.reduce(
      (sum, row) => sum + (Number(row.totalAttempts) || 0),
      0,
    );

    if (y < margin + 54) {
      page = pdfDoc.addPage(pageSize);
      y = page.getHeight() - margin;
    }

    y -= 16;
    drawText(
      page,
      `Tong ket: ${totalStudents} hoc sinh, ${studentsWithAttempts} hoc sinh co bai lam, ${totalAttempts} luot lam.`,
      margin,
      y,
      10,
      boldFont,
    );

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  }

  private toPdfText(value: string): string {
    return value
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\x20-\x7E]/g, '');
  }

  private truncateForWidth(
    font: PDFFont,
    value: string,
    size: number,
    maxWidth?: number,
  ): string {
    if (!maxWidth || font.widthOfTextAtSize(value, size) <= maxWidth) {
      return value;
    }

    let truncated = value;
    while (
      truncated.length > 0 &&
      font.widthOfTextAtSize(`${truncated}...`, size) > maxWidth
    ) {
      truncated = truncated.slice(0, -1);
    }

    return truncated ? `${truncated}...` : '';
  }

  private formatNullableScore(value: string | number | null): string {
    const score = this.toNullableNumber(value);
    return score === null ? '-' : score.toFixed(2);
  }

  private formatDate(value: Date): string {
    return value.toISOString().slice(0, 10);
  }

  private formatDateTime(value: Date): string {
    return value.toISOString().replace('T', ' ').slice(0, 19);
  }

  private formatCompletionDuration(
    startedAt: Date,
    submittedAt: Date | null,
  ): string {
    if (!submittedAt) {
      return '-';
    }

    const durationInSeconds = Math.max(
      0,
      Math.floor(
        (new Date(submittedAt).getTime() - new Date(startedAt).getTime()) /
          1000,
      ),
    );
    const hours = Math.floor(durationInSeconds / 3600);
    const minutes = Math.floor((durationInSeconds % 3600) / 60);
    const seconds = durationInSeconds % 60;

    if (hours > 0) {
      return `${hours} giờ ${minutes} phút ${seconds} giây`;
    }

    if (minutes > 0) {
      return `${minutes} phút ${seconds} giây`;
    }

    return `${seconds} giây`;
  }

  private formatReportFilters(filters: SchoolAttemptReportFilters): string {
    const parts = [
      filters.examSetId ? `Bo de: ${filters.examSetId}` : null,
      filters.questionBankId ? `De thi: ${filters.questionBankId}` : null,
      filters.fromDate ? `Tu ngay: ${filters.fromDate}` : null,
      filters.toDate ? `Den ngay: ${filters.toDate}` : null,
    ].filter(Boolean);

    return parts.length ? parts.join(' | ') : 'Bo loc: Tat ca bai lam';
  }

  private formatAttemptStatusForExport(status: string | null): string {
    switch (status) {
      case 'DOING':
        return 'Dang lam';
      case 'SUBMITTED':
        return 'Hoan thanh';
      default:
        return status ?? '';
    }
  }

  private toSafeFileName(value: string): string {
    return this.toPdfText(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private toWorksheetName(value: string): string {
    const sanitized = this.toPdfText(value)
      .replace(/[:\\/?*\[\]]/g, ' ')
      .trim();

    return (sanitized || 'Sheet').slice(0, 31);
  }

  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    );
  }
}
