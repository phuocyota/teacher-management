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
import { Workbook } from 'exceljs';
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
import { ZoneEntity } from 'src/zone/zone.entity';
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
import {
  ClassAttemptScoreExportRow,
  ClassSheetRawRow,
  ClassSheetRow,
  ReportStudentRow,
  SchoolAttemptReportFilters,
  SchoolAttemptReportRow,
  SchoolReportAccessScope,
  SchoolStatRawRow,
  SchoolStatRow,
  ZoneStatRawRow,
  ZoneStatRow,
  StudentAttemptDetailContext,
  StudentAttemptDetailRow,
  StudentAttemptScoreStats,
  StudentReportFilters,
} from './interfaces/report.interface';
import {
  applyTableBorder,
  clearBorders,
  clearFill,
  clearUnusedBorders,
  copyRowStyle,
  formatAttemptStatusForExport,
  formatCompletionDuration,
  formatDate,
  formatDateTime,
  formatNullableScore,
  formatReportFilters,
  getAssessmentLabel,
  normalizeOptionalFilter,
  setupSheetColumns,
  styleDataRow,
  styleStudentDetailRow,
  toNullableNumber,
  toPdfText,
  toSafeFileName,
  toWorksheetName,
  truncateForWidth,
} from './helpers/report.helper';

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
const ZONE_STAT_TEMPLATE_PATH = join(
  process.cwd(),
  'templates',
  'template-zone.xlsx',
);

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
    @InjectRepository(ZoneEntity)
    private readonly zoneRepo: Repository<ZoneEntity>,
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
    filters: StudentReportFilters,
  ): Promise<StudentReportDto> {
    this.ensureAuthenticatedUser(user);

    const groupId = normalizeOptionalFilter(filters.groupId);
    const zoneId = normalizeOptionalFilter(filters.zoneId);
    const schoolId = normalizeOptionalFilter(filters.schoolId);
    const studentId = normalizeOptionalFilter(filters.studentId);
    const isAllStudents = !studentId || studentId.toLowerCase() === 'all';

    if (!groupId && !schoolId && !zoneId) {
      throw new BadRequestException(
        'Can chon it nhat mot filter: zoneId, schoolId hoac groupId',
      );
    }

    const safePage =
      Number.isFinite(filters.page) && Number(filters.page) > 0
        ? Number(filters.page)
        : 1;
    const safeLimit =
      Number.isFinite(filters.limit) && Number(filters.limit) > 0
        ? Number(filters.limit)
        : 10;
    const skip = (safePage - 1) * safeLimit;

    if (groupId) {
      await this.ensureCanAccessStudentGroup(groupId, user);
    }

    const student =
      !isAllStudents && groupId
        ? await this.ensureStudentBelongsToGroup(groupId, studentId!)
        : !isAllStudents
          ? await this.getStudentOptionById(studentId!)
          : null;

    const summaryRaw = await this.buildAttemptReportScope(user, {
      zoneId,
      schoolId,
      groupId,
      studentId: isAllStudents ? undefined : studentId,
      fromDate: filters.fromDate,
      toDate: filters.toDate,
    })
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
      averageScore: toNullableNumber(summaryRaw?.averageScore),
      highestScore: toNullableNumber(summaryRaw?.highestScore),
      latestAttemptAt: summaryRaw?.latestAttemptAt
        ? new Date(summaryRaw.latestAttemptAt)
        : null,
    };

    const trendRows = await this.buildAttemptReportScope(user, {
      zoneId,
      schoolId,
      groupId,
      studentId: isAllStudents ? undefined : studentId,
      fromDate: filters.fromDate,
      toDate: filters.toDate,
    })
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
      averageScore: toNullableNumber(row.averageScore),
      highestScore: toNullableNumber(row.highestScore),
    }));

    const historyQb = this.buildAttemptReportScope(user, {
      zoneId,
      schoolId,
      groupId,
      studentId: isAllStudents ? undefined : studentId,
      fromDate: filters.fromDate,
      toDate: filters.toDate,
    })
      .leftJoin('attempt.questionBank', 'questionBank')
      .leftJoin('attempt.examSet', 'examSet')
      .select('attempt.id', 'attemptId')
      .addSelect('student.id', 'studentId')
      .addSelect('COALESCE(user.full_name, user.user_name)', 'studentName')
      .addSelect('student.code', 'studentCode')
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
        studentId: string;
        studentName: string | null;
        studentCode: string | null;
      }>(),
      this.buildAttemptReportScope(user, {
        zoneId,
        schoolId,
        groupId,
        studentId: isAllStudents ? undefined : studentId,
        fromDate: filters.fromDate,
        toDate: filters.toDate,
      }).getCount(),
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
      score: toNullableNumber(row.score),
      studentId: row.studentId,
      studentName: row.studentName,
      studentCode: row.studentCode,
    }));

    return {
      groupId: groupId ?? null,
      zoneId: zoneId ?? null,
      schoolId: schoolId ?? null,
      student,
      fromDate: filters.fromDate ?? null,
      toDate: filters.toDate ?? null,
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

    const school = await this.schoolRepo.findOne({ where: { id: schoolId } });
    if (!school) {
      throw new NotFoundException(
        ERROR_MESSAGES.NOT_FOUND_WITH_ID(ENTITY_NAMES.SCHOOL, schoolId),
      );
    }

    const accessScope = await this.ensureCanAccessSchoolReport(school, user);

    const rows = await this.getSchoolAttemptReportRows(
      schoolId,
      filters,
      accessScope,
    );
    const buffer = await this.buildSchoolAttemptReportPdf(
      school,
      rows,
      filters,
    );

    return {
      buffer,
      fileName: `school-attempt-report-${toSafeFileName(school.code)}.pdf`,
    };
  }

  async exportClassAttemptScoresExcel(
    user: JwtPayload,
    groupIds: string[],
    filters: SchoolAttemptReportFilters,
  ): Promise<{ buffer: Buffer; fileName: string }> {
    this.ensureAuthenticatedUser(user);

    const normalizedGroupIds = [
      ...new Set(groupIds.map((id) => id.trim())),
    ].filter(Boolean);

    if (normalizedGroupIds.length === 0) {
      throw new BadRequestException('groupIds la bat buoc');
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
      fileName: `class-attempt-scores-${formatDate(new Date())}.xlsx`,
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
      fileName: `chi-tiet-hs-${toSafeFileName(context.studentCode)}.xlsx`,
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

  private async createZoneStatWorkbook(): Promise<Workbook> {
    const workbook = new Workbook();
    workbook.creator = 'teacher-management';
    workbook.created = new Date();

    if (existsSync(ZONE_STAT_TEMPLATE_PATH)) {
      await workbook.xlsx.readFile(ZONE_STAT_TEMPLATE_PATH);
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
      fileName: `ket-qua-lop-${toSafeFileName(studentGroup.name)}.xlsx`,
    };
  }

  async exportSchoolStatSheetExcel(
    user: JwtPayload,
    schoolId: string,
    filters: SchoolAttemptReportFilters,
  ): Promise<{ buffer: Buffer; fileName: string }> {
    this.ensureAuthenticatedUser(user);

    const school = await this.schoolRepo.findOne({ where: { id: schoolId } });
    if (!school) {
      throw new NotFoundException(
        ERROR_MESSAGES.NOT_FOUND_WITH_ID(ENTITY_NAMES.SCHOOL, schoolId),
      );
    }

    const accessScope = await this.ensureCanAccessSchoolReport(school, user);

    const rows = await this.getSchoolStatSheetRows(
      schoolId,
      filters,
      accessScope,
    );
    const workbook = await this.createSchoolStatWorkbook();
    this.addSchoolStatWorksheet(workbook, school, rows, filters);

    const xlsx = await workbook.xlsx.writeBuffer();
    return {
      buffer: Buffer.from(xlsx),
      fileName: `thong-ke-truong-${toSafeFileName(school.code)}.xlsx`,
    };
  }

  async exportZoneStatSheetExcel(
    user: JwtPayload,
    zoneId: string,
    filters: SchoolAttemptReportFilters,
  ): Promise<{ buffer: Buffer; fileName: string }> {
    this.ensureAuthenticatedUser(user);

    const zone = await this.zoneRepo.findOne({ where: { id: zoneId } });
    if (!zone) {
      throw new NotFoundException(
        ERROR_MESSAGES.NOT_FOUND_WITH_ID(ENTITY_NAMES.ZONE, zoneId),
      );
    }

    const rows = await this.getZoneStatSheetRows(zoneId, filters, user);
    const workbook = await this.createZoneStatWorkbook();
    this.addZoneStatWorksheet(workbook, zone, rows);

    const xlsx = await workbook.xlsx.writeBuffer();
    return {
      buffer: Buffer.from(xlsx),
      fileName: `thong-ke-khu-vuc-${toSafeFileName(zone.code)}.xlsx`,
    };
  }

  private ensureAuthenticatedUser(user: JwtPayload): void {
    if (!user?.userId) {
      throw new ForbiddenException(ERROR_MESSAGES.INVALID_TOKEN_STRUCTURE);
    }
  }

  private async ensureCanAccessSchoolReport(
    school: SchoolEntity,
    user: JwtPayload,
  ): Promise<SchoolReportAccessScope> {
    if (user.userType === UserType.ADMIN) {
      return {};
    }

    if (school.principalUserId === user.userId) {
      return {};
    }

    const groupIds = await this.getAccessibleSchoolGroupIds(
      school.id,
      user.userId,
    );
    if (groupIds.length > 0) {
      return { groupIds };
    }

    throw new ForbiddenException(
      'Ban khong co quyen xem bao cao cua truong nay',
    );
  }

  private async getAccessibleSchoolGroupIds(
    schoolId: string,
    userId: string,
  ): Promise<string[]> {
    const rows = await this.studentGroupRepo
      .createQueryBuilder('studentGroup')
      .select('studentGroup.id', 'id')
      .innerJoin(
        'studentGroup.members',
        'studentGroupMember',
        'studentGroupMember.user_id = :userId AND studentGroupMember.role = :leaderRole',
        {
          userId,
          leaderRole: GroupMemberRole.LEADER,
        },
      )
      .where('studentGroup.schoolId = :schoolId', { schoolId })
      .getRawMany<{ id: string }>();

    return rows.map((row) => row.id);
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

  private async getStudentOptionById(
    studentId: string,
  ): Promise<ReportStudentOptionDto> {
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
      .where('student.id = :studentId', { studentId })
      .andWhere('user.user_type = :userType', { userType: UserType.STUDENT })
      .getRawOne<ReportStudentRow>();

    if (!row) {
      throw new NotFoundException(
        ERROR_MESSAGES.NOT_FOUND_WITH_ID(ENTITY_NAMES.STUDENT, studentId),
      );
    }

    return row;
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
    accessScope: SchoolReportAccessScope = {},
  ): Promise<SchoolAttemptReportRow[]> {
    const attemptJoinConditions = ['attempt.student_id = student.id'];
    const params: Record<string, string | string[]> = {
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

    const qb = this.studentRepo
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
      .addOrderBy('COALESCE(user.full_name, user.user_name)', 'ASC');

    if (accessScope.groupIds?.length) {
      qb.andWhere('studentGroup.id IN (:...accessGroupIds)', {
        accessGroupIds: accessScope.groupIds,
      });
    }

    return qb.getRawMany<SchoolAttemptReportRow>();
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
    const worksheet = workbook.addWorksheet(toWorksheetName(studentGroup.name));

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
      [`Ngay xuat: ${formatDateTime(new Date())}`],
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
        status: formatAttemptStatusForExport(row.status),
        startedAt: row.startedAt ? formatDateTime(row.startedAt) : '',
        submittedAt: row.submittedAt ? formatDateTime(row.submittedAt) : '',
        score: toNullableNumber(row.score) ?? '',
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
      highestScore: toNullableNumber(row?.highestScore ?? null),
      lowestScore: toNullableNumber(row?.lowestScore ?? null),
      averageScore: toNullableNumber(row?.averageScore ?? null),
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
      const score = toNullableNumber(row.score);
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
    accessScope: SchoolReportAccessScope = {},
  ): Promise<SchoolStatRow[]> {
    const rawRows = await this.getSchoolStatRawRows(
      schoolId,
      filters,
      accessScope,
    );
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
      const score = toNullableNumber(row.score);
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
        assessment: getAssessmentLabel(averageScore),
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
    accessScope: SchoolReportAccessScope = {},
  ): Promise<SchoolStatRawRow[]> {
    const attemptJoinConditions = ['attempt.student_id = student.id'];
    const params: Record<string, string | string[]> = {
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

    const qb = this.studentRepo
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
      .addOrderBy('attempt.started_at', 'DESC');

    if (accessScope.groupIds?.length) {
      qb.andWhere('studentGroup.id IN (:...accessGroupIds)', {
        accessGroupIds: accessScope.groupIds,
      });
    }

    return qb.getRawMany<SchoolStatRawRow>();
  }

  private async getZoneStatSheetRows(
    zoneId: string,
    filters: SchoolAttemptReportFilters,
    user: JwtPayload,
  ): Promise<ZoneStatRow[]> {
    const rawRows = await this.getZoneStatRawRows(zoneId, filters, user);
    const latestRows = new Map<string, ZoneStatRawRow>();

    for (const row of rawRows) {
      if (!latestRows.has(row.studentId)) {
        latestRows.set(row.studentId, row);
      }
    }

    const statsBySchool = new Map<
      string,
      ZoneStatRow & {
        totalScore: number;
        groupIds: Set<string>;
        attemptedGroupIds: Set<string>;
      }
    >();

    for (const row of latestRows.values()) {
      const current =
        statsBySchool.get(row.schoolId) ??
        ({
          schoolId: row.schoolId,
          schoolName: row.schoolName,
          totalGroups: 0,
          attemptedGroups: 0,
          absentGroups: 0,
          totalStudents: 0,
          attemptedStudents: 0,
          absentStudents: 0,
          averageScore: null,
          completionRate: 0,
          assessment: '',
          totalScore: 0,
          groupIds: new Set<string>(),
          attemptedGroupIds: new Set<string>(),
        } satisfies ZoneStatRow & {
          totalScore: number;
          groupIds: Set<string>;
          attemptedGroupIds: Set<string>;
        });

      current.groupIds.add(row.studentGroupId);
      current.totalStudents += 1;

      const score = toNullableNumber(row.score);
      if (row.attemptId && score !== null) {
        current.attemptedStudents += 1;
        current.totalScore += score;
        current.attemptedGroupIds.add(row.studentGroupId);
      }

      statsBySchool.set(row.schoolId, current);
    }

    return [...statsBySchool.values()]
      .map((row) => {
        const totalGroups = row.groupIds.size;
        const attemptedGroups = row.attemptedGroupIds.size;
        const absentStudents = row.totalStudents - row.attemptedStudents;
        const averageScore =
          row.attemptedStudents > 0
            ? row.totalScore / row.attemptedStudents
            : null;
        const completionRate =
          row.totalStudents > 0
            ? (row.attemptedStudents / row.totalStudents) * 100
            : 0;

        return {
          schoolId: row.schoolId,
          schoolName: row.schoolName,
          totalGroups,
          attemptedGroups,
          absentGroups: totalGroups - attemptedGroups,
          totalStudents: row.totalStudents,
          attemptedStudents: row.attemptedStudents,
          absentStudents,
          averageScore,
          completionRate,
          assessment: this.getCompletionAssessmentLabel(completionRate),
        };
      })
      .sort((a, b) => a.schoolName.localeCompare(b.schoolName));
  }

  private async getZoneStatRawRows(
    zoneId: string,
    filters: SchoolAttemptReportFilters,
    user: JwtPayload,
  ): Promise<ZoneStatRawRow[]> {
    const attemptJoinConditions = ['attempt.student_id = student.id'];
    const params: Record<string, string> = {
      zoneId,
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

    const qb = this.studentRepo
      .createQueryBuilder('student')
      .innerJoin(UserEntity, 'user', 'user.id = student.id')
      .innerJoin(
        StudentGroupEntity,
        'studentGroup',
        'studentGroup.id = student.student_group_id',
      )
      .innerJoin('studentGroup.school', 'school')
      .leftJoin(AttemptEntity, 'attempt', attemptJoinConditions.join(' AND '))
      .select('student.id', 'studentId')
      .addSelect('student.code', 'studentCode')
      .addSelect('studentGroup.id', 'studentGroupId')
      .addSelect('studentGroup.name', 'studentGroupName')
      .addSelect('school.id', 'schoolId')
      .addSelect('school.name', 'schoolName')
      .addSelect('user.full_name', 'fullName')
      .addSelect('user.user_name', 'userName')
      .addSelect('attempt.id', 'attemptId')
      .addSelect('attempt.score', 'score')
      .addSelect('attempt.started_at', 'startedAt')
      .where('school.zone_id = :zoneId')
      .andWhere('user.user_type = :userType')
      .setParameters(params)
      .orderBy('school.name', 'ASC')
      .addOrderBy('studentGroup.name', 'ASC')
      .addOrderBy('COALESCE(user.full_name, user.user_name)', 'ASC')
      .addOrderBy('attempt.started_at', 'DESC');

    if (user.userType !== UserType.ADMIN) {
      qb.andWhere(
        this.canAccessStudentGroupCondition(),
        this.accessParams(user.userId),
      );
    }

    return qb.getRawMany<ZoneStatRawRow>();
  }

  private getCompletionAssessmentLabel(completionRate: number): string {
    if (completionRate >= 100) {
      return 'Hoàn thành tốt';
    }
    if (completionRate >= 80) {
      return 'Khá';
    }
    if (completionRate >= 50) {
      return 'Chậm tiến độ';
    }
    return 'Cần nhắc nhở';
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
      setupSheetColumns(worksheet, [14, 14, 14, 22, 22, 22]);
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
      styleStudentDetailRow(excelRow);
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
    styleStudentDetailRow(worksheet.getRow(summaryRowIndex), true);
    clearBorders(worksheet, 9, summaryRowIndex, 3);
    clearFill(worksheet, 1, Math.max(35, averageScoreRowIndex), 8);
    clearUnusedBorders(worksheet, 1, Math.max(35, averageScoreRowIndex), 8);

    worksheet.getCell(`B${scoreRowIndex}`).value =
      `ĐIỂM: ${formatNullableScore(context.score)}`;
    worksheet.getCell(`B${dateRowIndex}`).value = `Ngày kiểm tra: ${
      context.submittedAt
        ? formatDate(new Date(context.submittedAt))
        : formatDate(context.startedAt)
    }`;
    worksheet.getCell(`D${scoreRowIndex}`).value = formatCompletionDuration(
      context.startedAt,
      context.submittedAt,
    );
    worksheet.getCell(`A${noteRowIndex}`).value = 'Ghi chú:';
    worksheet.getCell(`B${noteRowIndex}`).value =
      `Số lần làm bài: ${stats.attemptCount}`;
    worksheet.getCell(`B${highestScoreRowIndex}`).value =
      `Điểm số cao nhất: ${formatNullableScore(stats.highestScore)}`;
    worksheet.getCell(`B${lowestScoreRowIndex}`).value =
      `Điểm số thấp nhất: ${formatNullableScore(stats.lowestScore)}`;
    worksheet.getCell(`B${averageScoreRowIndex}`).value =
      `Trung bình điểm thi: ${formatNullableScore(stats.averageScore)}`;
    clearFill(worksheet, 1, Math.max(35, averageScoreRowIndex), 8);
    clearUnusedBorders(worksheet, 1, Math.max(35, averageScoreRowIndex), 8);
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
      setupSheetColumns(worksheet, [8, 28, 18, 14, 14, 20, 26, 20, 16]);
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
        copyRowStyle(templateRow, excelRow, 10);
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
        ? formatDateTime(row.startedAt)
        : '';
      excelRow.getCell(8).value = '';
      excelRow.getCell(9).value = '';
      excelRow.getCell(10).value = '';
      styleDataRow(excelRow);
      excelRow.commit();
    });

    if (rows.length === 0) {
      for (let col = 1; col <= 10; col += 1) {
        templateRow.getCell(col).value = '';
      }
    }

    applyTableBorder(
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
      setupSheetColumns(
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
        copyRowStyle(templateRow, excelRow, 12);
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
      styleDataRow(excelRow);
      excelRow.commit();
    });

    if (rows.length === 0) {
      for (let col = 1; col <= 12; col += 1) {
        templateRow.getCell(col).value = '';
      }
    }

    applyTableBorder(
      worksheet,
      8,
      Math.max(dataStartRow, dataStartRow + rows.length - 1),
      12,
    );
  }

  private addZoneStatWorksheet(
    workbook: Workbook,
    zone: ZoneEntity,
    rows: ZoneStatRow[],
  ): void {
    const worksheet =
      workbook.getWorksheet('Sheet1') ??
      workbook.addWorksheet('Thống kê KHU VỰC');

    if (!worksheet.columns.length) {
      setupSheetColumns(
        worksheet,
        [8, 16, 30, 24, 14, 14, 14, 14, 14, 14, 16, 16, 18, 18],
      );
    }

    const dataWorksheet = workbook.getWorksheet('data');
    if (dataWorksheet) {
      dataWorksheet.getCell('B6').value = zone.name;
    }

    worksheet.getCell('A4').value = [
      'KỲ THI ĐÁNH GIÁ HỌC KỲ II - NĂM HỌC: 2025 2026',
      'BẢNG THỐNG KÊ KHU VỰC',
      `TỈNH/THÀNH PHỐ: ${zone.name}`,
      'CHƯƠNG TRÌNH GIÁO DỤC ICHI SKILL',
    ].join('\n');

    const dataStartRow = 9;
    const templateRow = worksheet.getRow(dataStartRow);
    rows.forEach((row, index) => {
      const rowIndex = dataStartRow + index;
      const excelRow = worksheet.getRow(rowIndex);
      if (rowIndex !== dataStartRow) {
        copyRowStyle(templateRow, excelRow, 14);
      }
      excelRow.getCell(1).value = index + 1;
      excelRow.getCell(2).value = '';
      excelRow.getCell(3).value = row.schoolName;
      excelRow.getCell(4).value = '';
      excelRow.getCell(5).value = row.totalGroups;
      excelRow.getCell(6).value = row.attemptedGroups;
      excelRow.getCell(7).value = row.absentGroups;
      excelRow.getCell(8).value = row.totalStudents;
      excelRow.getCell(9).value = row.attemptedStudents;
      excelRow.getCell(10).value = row.absentStudents;
      excelRow.getCell(11).value =
        row.averageScore === null ? '' : Number(row.averageScore.toFixed(2));
      excelRow.getCell(12).value = Number(row.completionRate.toFixed(2));
      excelRow.getCell(13).value = row.assessment;
      excelRow.getCell(14).value = '';
      styleDataRow(excelRow);
      excelRow.commit();
    });

    if (rows.length === 0) {
      for (let col = 1; col <= 14; col += 1) {
        templateRow.getCell(col).value = '';
      }
    }

    applyTableBorder(
      worksheet,
      8,
      Math.max(dataStartRow, dataStartRow + rows.length - 1),
      14,
    );
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

  private buildAttemptReportScope(
    user: JwtPayload,
    filters: {
      zoneId?: string;
      schoolId?: string;
      groupId?: string;
      studentId?: string;
      fromDate?: string;
      toDate?: string;
    },
  ) {
    const qb = this.attemptRepo
      .createQueryBuilder('attempt')
      .innerJoin('attempt.student', 'student')
      .innerJoin(UserEntity, 'user', 'user.id = student.id')
      .leftJoin('student.studentGroup', 'studentGroup')
      .leftJoin('studentGroup.school', 'school')
      .leftJoin('school.zone', 'zone')
      .where('user.user_type = :studentUserType', {
        studentUserType: UserType.STUDENT,
      });

    if (filters.zoneId) {
      qb.andWhere('zone.id = :zoneId', { zoneId: filters.zoneId });
    }

    if (filters.schoolId) {
      qb.andWhere('school.id = :schoolId', { schoolId: filters.schoolId });
    }

    if (filters.groupId) {
      qb.andWhere('studentGroup.id = :groupId', { groupId: filters.groupId });
    }

    if (filters.studentId) {
      qb.andWhere('student.id = :studentId', { studentId: filters.studentId });
    }

    if (filters.fromDate) {
      qb.andWhere('DATE(attempt.started_at) >= :fromDate', {
        fromDate: filters.fromDate,
      });
    }

    if (filters.toDate) {
      qb.andWhere('DATE(attempt.started_at) <= :toDate', {
        toDate: filters.toDate,
      });
    }

    if (user.userType !== UserType.ADMIN) {
      qb.andWhere(
        this.canAccessStudentGroupCondition(),
        this.accessParams(user.userId),
      );
    }

    return qb;
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
        truncateForWidth(targetFont, toPdfText(text), size, maxWidth),
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
    drawText(page, `Ngay xuat: ${formatDateTime(new Date())}`, margin, y, 10);
    y -= 16;
    drawText(page, formatReportFilters(filters), margin, y, 10);
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
        formatNullableScore(row.averageScore),
        formatNullableScore(row.highestScore),
        row.latestAttemptAt ? formatDate(row.latestAttemptAt) : '-',
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
}
