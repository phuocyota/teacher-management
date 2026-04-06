import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AttemptEntity } from 'src/attempt/attempt.entity';
import { GroupEntity } from 'src/group/entity/group.entity';
import {
  ERROR_MESSAGES,
  ENTITY_NAMES,
} from 'src/common/constant/error-messages.constant';
import { JwtPayload } from 'src/common/interface/jwt-payload.interface';
import { UserGroupEntity } from 'src/user-group/entity/user-group.entity';
import { GroupMemberRole } from 'src/user-group/enum/group-member-role.enum';
import { UserEntity } from 'src/user/user.entity';
import { UserType } from 'src/common/enum/user-type.enum';
import { StudentEntity } from 'src/student/student.entity';
import { StudentGroupEntity } from 'src/student-group/student-group.entity';
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
  studentGroupId: string;
  studentGroupName: string | null;
};

@Injectable()
export class ReportService {
  constructor(
    @InjectRepository(AttemptEntity)
    private readonly attemptRepo: Repository<AttemptEntity>,
    @InjectRepository(GroupEntity)
    private readonly groupRepo: Repository<GroupEntity>,
    @InjectRepository(UserGroupEntity)
    private readonly userGroupRepo: Repository<UserGroupEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(StudentEntity)
    private readonly studentRepo: Repository<StudentEntity>,
  ) {}

  async getLeaderGroups(user: JwtPayload): Promise<TeacherLeaderGroupDto[]> {
    this.ensureAuthenticatedUser(user);

    const rows = await this.userGroupRepo
      .createQueryBuilder('userGroup')
      .innerJoin('userGroup.group', 'group')
      .select('group.id', 'id')
      .addSelect('group.name', 'name')
      .addSelect('group.type', 'type')
      .where('userGroup.userId = :teacherId', { teacherId: user.userId })
      .andWhere('userGroup.role = :role', { role: GroupMemberRole.LEADER })
      .orderBy('group.name', 'ASC')
      .getRawMany<TeacherLeaderGroupDto>();

    return rows;
  }

  async getGroupStudents(
    groupId: string,
    user: JwtPayload,
  ): Promise<ReportStudentOptionDto[]> {
    this.ensureAuthenticatedUser(user);
    await this.ensureTeacherLeadsGroup(groupId, user.userId);

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

    await this.ensureTeacherLeadsGroup(groupId, user.userId);
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

  private ensureAuthenticatedUser(user: JwtPayload): void {
    if (!user?.userId) {
      throw new ForbiddenException(ERROR_MESSAGES.INVALID_TOKEN_STRUCTURE);
    }
  }

  private async ensureTeacherLeadsGroup(
    groupId: string,
    teacherId: string,
  ): Promise<void> {
    const group = await this.groupRepo.findOne({ where: { id: groupId } });
    if (!group) {
      throw new NotFoundException(
        ERROR_MESSAGES.NOT_FOUND_WITH_ID(ENTITY_NAMES.GROUP, groupId),
      );
    }

    const leaderLink = await this.userGroupRepo.findOne({
      where: {
        groupId,
        userId: teacherId,
        role: GroupMemberRole.LEADER,
      },
    });

    if (!leaderLink) {
      throw new ForbiddenException(ERROR_MESSAGES.ACCESS_DENIED_TEACHER);
    }
  }

  private async ensureStudentBelongsToGroup(
    groupId: string,
    studentId: string,
  ): Promise<ReportStudentOptionDto> {
    const row = await this.getStudentRowInGroup(groupId, studentId);

    if (!row) {
      const user = await this.userRepo.findOne({ where: { id: studentId } });
      const student = await this.studentRepo.findOne({ where: { id: studentId } });

      if (!user || !student || user.userType !== UserType.STUDENT) {
        throw new NotFoundException(
          ERROR_MESSAGES.NOT_FOUND_WITH_ID(ENTITY_NAMES.STUDENT, studentId),
        );
      }

      throw new NotFoundException('Hoc sinh khong thuoc group duoc chon');
    }

    return row;
  }

  private async getStudentRowsInGroup(groupId: string): Promise<ReportStudentRow[]> {
    return this.userGroupRepo
      .createQueryBuilder('userGroup')
      .innerJoin(UserEntity, 'user', 'user.id = userGroup.userId')
      .innerJoin(StudentEntity, 'student', 'student.id = user.id')
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
      .where('userGroup.groupId = :groupId', { groupId })
      .andWhere('user.user_type = :userType', { userType: UserType.STUDENT })
      .orderBy('COALESCE(user.full_name, user.user_name)', 'ASC')
      .getRawMany<ReportStudentRow>();
  }

  private async getStudentRowInGroup(
    groupId: string,
    studentId: string,
  ): Promise<ReportStudentOptionDto | null> {
    const row = await this.userGroupRepo
      .createQueryBuilder('userGroup')
      .innerJoin(UserEntity, 'user', 'user.id = userGroup.userId')
      .innerJoin(StudentEntity, 'student', 'student.id = user.id')
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
      .where('userGroup.groupId = :groupId', { groupId })
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
}
