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
import { Repository } from 'typeorm';
import { AttemptEntity } from 'src/attempt/attempt.entity';
import {
  ERROR_MESSAGES,
  ENTITY_NAMES,
} from 'src/common/constant/error-messages.constant';
import { JwtPayload } from 'src/common/interface/jwt-payload.interface';
import { UserEntity } from 'src/user/user.entity';
import { UserType } from 'src/common/enum/user-type.enum';
import { StudentEntity } from 'src/student/student.entity';
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

@Injectable()
export class ReportService {
  constructor(
    @InjectRepository(AttemptEntity)
    private readonly attemptRepo: Repository<AttemptEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(StudentEntity)
    private readonly studentRepo: Repository<StudentEntity>,
    @InjectRepository(StudentGroupEntity)
    private readonly studentGroupRepo: Repository<StudentGroupEntity>,
    @InjectRepository(SchoolEntity)
    private readonly schoolRepo: Repository<SchoolEntity>,
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
            FROM user_group leaderLink
            INNER JOIN user_group studentLink
              ON studentLink.group_id = leaderLink.group_id
            INNER JOIN student linkedStudent
              ON linkedStudent.id = studentLink.user_id
            INNER JOIN "user" linkedUser
              ON linkedUser.id = linkedStudent.id
            WHERE leaderLink.user_id = :userId
              AND leaderLink.role = :leaderRole
              AND linkedUser.user_type = :studentType
              AND linkedStudent.student_group_id = "studentGroup".id
          )
        )`,
        {
          userId: user.userId,
          leaderRole: GroupMemberRole.LEADER,
          studentType: UserType.STUDENT,
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
        FROM user_group leaderLink
        INNER JOIN user_group studentLink
          ON studentLink.group_id = leaderLink.group_id
        INNER JOIN student linkedStudent
          ON linkedStudent.id = studentLink.user_id
        INNER JOIN "user" linkedUser
          ON linkedUser.id = linkedStudent.id
        WHERE leaderLink.user_id = :userId
          AND leaderLink.role = :leaderRole
          AND linkedUser.user_type = :studentType
          AND linkedStudent.student_group_id = "studentGroup".id
      )
    )`;
  }

  private accessParams(userId: string): {
    userId: string;
    leaderRole: GroupMemberRole;
    studentType: UserType;
  } {
    return {
      userId,
      leaderRole: GroupMemberRole.LEADER,
      studentType: UserType.STUDENT,
    };
  }

  async getGroupStudents(
    groupId: string,
    user: JwtPayload,
  ): Promise<ReportStudentOptionDto[]> {
    this.ensureAuthenticatedUser(user);
    await this.ensureCanAccessStudentGroup(groupId, user.userId);

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

    await this.ensureCanAccessStudentGroup(groupId, user.userId);
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
      .skip(skip)
      .take(safeLimit);

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
    schoolId: string,
    filters: SchoolAttemptReportFilters,
  ): Promise<{ buffer: Buffer; fileName: string }> {
    this.validateDateRange(filters.fromDate, filters.toDate);

    const school = await this.schoolRepo.findOne({ where: { id: schoolId } });
    if (!school) {
      throw new NotFoundException(
        ERROR_MESSAGES.NOT_FOUND_WITH_ID(ENTITY_NAMES.SCHOOL, schoolId),
      );
    }

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

  private ensureAuthenticatedUser(user: JwtPayload): void {
    if (!user?.userId) {
      throw new ForbiddenException(ERROR_MESSAGES.INVALID_TOKEN_STRUCTURE);
    }
  }

  private async ensureCanAccessStudentGroup(
    groupId: string,
    userId: string,
  ): Promise<void> {
    const studentGroup = await this.studentGroupRepo.findOne({
      where: { id: groupId },
    });
    if (!studentGroup) {
      throw new NotFoundException(
        ERROR_MESSAGES.NOT_FOUND_WITH_ID(ENTITY_NAMES.STUDENT_GROUP, groupId),
      );
    }

    const accessibleCount = await this.studentGroupRepo
      .createQueryBuilder('studentGroup')
      .innerJoin('studentGroup.school', 'school')
      .where('studentGroup.id = :groupId', { groupId })
      .andWhere(this.canAccessStudentGroupCondition(), this.accessParams(userId))
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

  private formatReportFilters(filters: SchoolAttemptReportFilters): string {
    const parts = [
      filters.examSetId ? `Bo de: ${filters.examSetId}` : null,
      filters.questionBankId ? `De thi: ${filters.questionBankId}` : null,
      filters.fromDate ? `Tu ngay: ${filters.fromDate}` : null,
      filters.toDate ? `Den ngay: ${filters.toDate}` : null,
    ].filter(Boolean);

    return parts.length ? parts.join(' | ') : 'Bo loc: Tat ca bai lam';
  }

  private toSafeFileName(value: string): string {
    return this.toPdfText(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
