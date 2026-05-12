import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Not, Repository } from 'typeorm';
import { UserEntity } from './user.entity';
import { AddNfcIdDto, ChangePasswordDto, UserQueryDto } from './dto/user.dto';
import { CreateUserDto } from './dto/create.dto';
import { UpdateUserDto } from './dto/update.dto';
import { JwtPayload } from 'src/common/interface/jwt-payload.interface';
import { BaseService } from 'src/common/sql/base.service';
import { UserGroupService } from '../user-group/user-group.service';
import {
  ERROR_MESSAGES,
  ENTITY_NAMES,
} from 'src/common/constant/error-messages.constant';
import { runInTransaction } from 'src/common/database/transaction.utils';
import { UserType } from 'src/common/enum/user-type.enum';
import { StudentEntity } from 'src/student/student.entity';
import { TeacherEntity } from 'src/teacher/teacher.entity';
import { StudentGroupEntity } from 'src/student-group/student-group.entity';
import { SchoolEntity } from 'src/school/school.entity';
import { AttemptEntity } from 'src/attempt/attempt.entity';
import { CertificateLevel } from 'src/common/enum/certificate-level.enum';

type StudentCertificateRow = {
  attemptId: string;
  studentName: string | null;
  userName: string;
  className: string | null;
  schoolName: string | null;
  submittedAt: Date | string | null;
  score: string | number | null;
  subjectName: string | null;
  questionBankName: string | null;
  gradeCode: string | null;
  gradeName: string | null;
};

type StudentCertificate = {
  id: number;
  name: string;
  className: string;
  school: string;
  date: string;
  subject: string;
  level: CertificateLevel;
};

@Injectable()
export class UserService extends BaseService<UserEntity> {
  private static readonly MAX_TEACHER_CODE_RETRIES = 10;

  constructor(
    @InjectRepository(UserEntity)
    userRepo: Repository<UserEntity>,
    private readonly userGroupService: UserGroupService,
    private readonly entityManager: EntityManager,
  ) {
    super(userRepo);
  }

  protected getEntityName(): string {
    return 'User';
  }

  private async generateNextTeacherCode(
    teacherRepo: Repository<TeacherEntity>,
  ): Promise<string> {
    const teachers = await teacherRepo.find({
      select: ['code'],
    });

    const maxCode = teachers.reduce((max, teacher) => {
      const match = teacher.code?.match(/^GV(\d+)$/);
      if (!match) {
        return max;
      }

      return Math.max(max, Number(match[1]));
    }, 0);

    return `GV${String(maxCode + 1).padStart(3, '0')}`;
  }

  private isTeacherCodeUniqueViolation(error: unknown): boolean {
    if (
      !error ||
      typeof error !== 'object' ||
      !('code' in error) ||
      !('detail' in error)
    ) {
      return false;
    }

    return (
      error.code === '23505' &&
      typeof error.detail === 'string' &&
      error.detail.includes('(code)')
    );
  }

  public async findByUsernameOrEmail(
    identifier: string,
  ): Promise<UserEntity | null> {
    const user = await this.repo.findOne({
      where: [{ userName: identifier }, { email: identifier }],
    });

    return user ?? null;
  }

  public async findByNfcId(nfcId: string): Promise<UserEntity | null> {
    const user = await this.repo.findOne({
      where: { nfcId },
    });

    return user ?? null;
  }

  /**   * Kiểm tra userName và email đã tồn tại chưa
   */
  private async checkUserExisting(dto: CreateUserDto): Promise<void> {
    const where: Array<{ userName?: string; email?: string }> = [
      { userName: dto.userName },
    ];
    if (dto.email) {
      where.push({ email: dto.email });
    }

    const existing = await this.repo.findOne({
      where,
    });

    if (existing) {
      if (existing.userName === dto.userName) {
        throw new ConflictException(ERROR_MESSAGES.USERNAME_ALREADY_EXISTS);
      }
      if (dto.email && existing.email === dto.email) {
        throw new ConflictException(ERROR_MESSAGES.EMAIL_ALREADY_EXISTS);
      }
      throw new ConflictException(ERROR_MESSAGES.USER_ALREADY_EXISTS);
    }
  }

  /**
   * Tạo user mới với hash password và kiểm tra unique
   */
  public async createUser(dto: CreateUserDto, user?: JwtPayload) {
    return runInTransaction(this.entityManager, async (manager) => {
      const userRepo = manager.getRepository(UserEntity);
      const studentRepo = manager.getRepository(StudentEntity);
      const teacherRepo = manager.getRepository(TeacherEntity);
      await this.checkUserExisting(dto);

      const {
        groupIds,
        studentGroupId,
        schoolId,
        code,
        studentCode,
        deviceId,
        teacherCode,
        ...userPayload
      } = dto;

      const saltRounds = 10;
      const hashPassword = await bcrypt.hash(dto.password, saltRounds);

      const savedUser = await userRepo.save(
        userRepo.create({
          ...userPayload,
          createdBy: user?.userId,
          hashPassword,
        }),
      );

      if (savedUser.userType === UserType.STUDENT) {
        const studentCodeValue = code ?? studentCode;

        if (!studentCodeValue) {
          throw new BadRequestException(
            'code la bat buoc khi tao user STUDENT',
          );
        }

        const existingStudentByCode = await studentRepo.findOne({
          where: { code: studentCodeValue },
        });

        if (existingStudentByCode) {
          throw new ConflictException('Ma hoc sinh da ton tai');
        }

        const studentGroup = studentGroupId
          ? await manager
              .getRepository(StudentGroupEntity)
              .findOne({ where: { id: studentGroupId } })
          : null;

        if (studentGroupId && !studentGroup) {
          throw new NotFoundException(
            ERROR_MESSAGES.NOT_FOUND(ENTITY_NAMES.STUDENT_GROUP),
          );
        }

        const resolvedSchoolId = schoolId ?? studentGroup?.schoolId ?? null;

        if (
          schoolId &&
          studentGroup?.schoolId &&
          schoolId !== studentGroup.schoolId
        ) {
          throw new BadRequestException(
            'schoolId phai trung voi truong cua nhom hoc sinh',
          );
        }

        if (resolvedSchoolId) {
          const school = await manager
            .getRepository(SchoolEntity)
            .findOne({ where: { id: resolvedSchoolId } });

          if (!school) {
            throw new NotFoundException(
              ERROR_MESSAGES.NOT_FOUND(ENTITY_NAMES.SCHOOL),
            );
          }
        }

        await studentRepo.save(
          studentRepo.create({
            id: savedUser.id,
            studentGroupId: studentGroupId ?? null,
            schoolId: resolvedSchoolId,
            code: studentCodeValue,
            createdBy: user?.userId,
          }),
        );
      }

      if (savedUser.userType === UserType.TEACHER) {
        let attempt = 0;

        while (attempt < UserService.MAX_TEACHER_CODE_RETRIES) {
          const teacherCodeValue =
            teacherCode ?? (await this.generateNextTeacherCode(teacherRepo));

          const existingTeacherByCode = await teacherRepo.findOne({
            where: { code: teacherCodeValue },
          });

          if (existingTeacherByCode) {
            if (teacherCode) {
              throw new ConflictException('Ma giao vien da ton tai');
            }

            attempt += 1;
            continue;
          }

          try {
            await teacherRepo.save(
              teacherRepo.create({
                id: savedUser.id,
                code: teacherCodeValue,
                deviceId,
                name: savedUser.fullName ?? savedUser.userName,
                email: savedUser.email ?? `${savedUser.userName}@local.invalid`,
                createdBy: user?.userId,
              }),
            );
            break;
          } catch (error) {
            if (!teacherCode && this.isTeacherCodeUniqueViolation(error)) {
              attempt += 1;
              continue;
            }

            throw error;
          }
        }

        if (attempt === UserService.MAX_TEACHER_CODE_RETRIES) {
          throw new ConflictException('Khong the tu sinh ma giao vien');
        }
      }

      if (groupIds?.length && user) {
        await this.userGroupService.addUserToGroups(
          groupIds,
          savedUser.id,
          user?.userId,
          manager,
        );
      }

      return savedUser;
    });
  }

  /**   * Kiểm tra email đã tồn tại chưa
   */
  private async checkEmailExisting(email: string): Promise<void> {
    const existing = await this.repo.findOne({
      where: { email },
    });

    if (existing) {
      throw new ConflictException(ERROR_MESSAGES.EMAIL_ALREADY_EXISTS);
    }
  }

  /**
   * Cập nhật user
   */
  async updateUser(id: string, dto: UpdateUserDto, user?: JwtPayload) {
    return runInTransaction(this.entityManager, async (manager) => {
      const userRepo = manager.getRepository(UserEntity);

      const existingUser = await userRepo.findOne({ where: { id } });

      if (!existingUser) {
        throw new NotFoundException(
          ERROR_MESSAGES.NOT_FOUND(ENTITY_NAMES.USER),
        );
      }

      if (dto.email && dto.email !== existingUser.email) {
        await this.checkEmailExisting(dto.email);
      }

      // Handle disable / enable
      if (
        dto.isDisabled !== undefined &&
        dto.isDisabled !== existingUser.isDisabled
      ) {
        existingUser.isDisabled = dto.isDisabled;
        existingUser.disabledAt = dto.isDisabled ? new Date() : undefined;
      }

      Object.assign(existingUser, {
        ...dto,
        updatedBy: user?.userId,
      });

      if (dto.groupIds?.length && user) {
        await this.userGroupService.updateUserGroups(
          dto.groupIds,
          existingUser.id,
          user?.userId,
          manager,
        );
      }

      return userRepo.save(existingUser);
    });
  }

  async addNfcId(
    id: string,
    dto: AddNfcIdDto,
    user?: JwtPayload,
  ): Promise<UserEntity> {
    const nfcId = dto.nfcId.trim();

    if (!nfcId) {
      throw new BadRequestException('NFC ID khong duoc de trong');
    }

    const existingUser = await this.repo.findOne({ where: { id } });

    if (!existingUser) {
      throw new NotFoundException(ERROR_MESSAGES.NOT_FOUND(ENTITY_NAMES.USER));
    }

    const existingNfcUser = await this.repo.findOne({
      where: {
        id: Not(id),
        nfcId,
      },
    });

    if (existingNfcUser) {
      throw new ConflictException('NFC ID da duoc gan cho user khac');
    }

    existingUser.nfcId = nfcId;
    existingUser.updatedBy = user?.userId;

    return this.repo.save(existingUser);
  }

  /**
   * Đổi mật khẩu
   */
  async changePassword(
    id: string,
    dto: ChangePasswordDto,
    user?: JwtPayload,
  ): Promise<void> {
    const queryRunner = this.entityManager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const userRepo = queryRunner.manager.getRepository(UserEntity);
      const existingUser = await userRepo.findOne({ where: { id } });

      if (!existingUser) {
        throw new NotFoundException(
          ERROR_MESSAGES.NOT_FOUND(ENTITY_NAMES.USER),
        );
      }

      const isMatch = await bcrypt.compare(
        dto.currentPassword,
        existingUser.hashPassword,
      );

      if (!isMatch) {
        throw new BadRequestException(
          ERROR_MESSAGES.CURRENT_PASSWORD_INCORRECT,
        );
      }

      const saltRounds = 10;
      const hash = await bcrypt.hash(dto.newPassword, saltRounds);

      existingUser.hashPassword = hash;
      existingUser.updatedBy = user?.userId;

      await userRepo.save(existingUser);
      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Tìm kiếm và phân trang user
   */
  async findAllWithQuery(query: UserQueryDto) {
    const {
      page = 1,
      limit = 10,
      search,
      userType,
      status,
      isDisabled,
      groupId,
      excludeGroupId,
    } = query;

    const skip = (page - 1) * limit;

    const qb = this.repo.createQueryBuilder('user');

    /* =====================
     * CONDITIONAL JOIN
     * ===================== */
    if (groupId) {
      qb.innerJoin(
        'user_group',
        'ug',
        'ug.user_id = user.id AND ug.group_id = :groupId',
        { groupId },
      );
    }

    if (excludeGroupId) {
      qb.leftJoin(
        'user_group',
        'ug_exclude',
        'ug_exclude.user_id = user.id AND ug_exclude.group_id = :excludeGroupId',
        { excludeGroupId },
      ).andWhere('ug_exclude.user_id IS NULL');
    }

    /* =====================
     * WHERE
     * ===================== */
    if (userType) {
      qb.andWhere('user.userType = :userType', { userType });
    }

    if (status) {
      qb.andWhere('user.status = :status', { status });
    }

    if (isDisabled !== undefined) {
      qb.andWhere('user.isDisabled = :isDisabled', { isDisabled });
    }

    /* =====================
     * SEARCH
     * ===================== */
    if (search) {
      qb.andWhere(
        `
      (
        user.fullName ILIKE :search
        OR user.email ILIKE :search
        OR user.userName ILIKE :search
      )
      `,
        { search: `%${search}%` },
      );
    }

    /* =====================
     * PAGINATION
     * ===================== */
    const [items, total] = await qb
      .orderBy('user.createdAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getMe(userId: string) {
    const user = await this.repo.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException(ERROR_MESSAGES.NOT_FOUND(ENTITY_NAMES.USER));
    }

    const safeUser: Partial<UserEntity> = { ...user };
    delete safeUser.hashPassword;

    if (user.userType !== UserType.STUDENT) {
      return safeUser;
    }

    const student = await this.entityManager
      .getRepository(StudentEntity)
      .findOne({
        where: { id: user.id },
        relations: ['studentGroup', 'studentGroup.school', 'school'],
      });

    return {
      ...safeUser,
      studentCode: student?.code,
      className: student?.studentGroup?.name,
      schoolName: student?.studentGroup?.school?.name,
      certificates: await this.getStudentCertificates(user.id),
    };
  }

  private async getStudentCertificates(
    studentId: string,
  ): Promise<StudentCertificate[]> {
    const rows = await this.entityManager
      .getRepository(AttemptEntity)
      .createQueryBuilder('attempt')
      .innerJoin('attempt.student', 'student')
      .innerJoin(UserEntity, 'user', 'user.id = student.id')
      .leftJoin('student.studentGroup', 'studentgroup')
      .leftJoin('studentgroup.school', 'school')
      .leftJoin('attempt.examSet', 'examset')
      .leftJoin('attempt.questionBank', 'questionbank')
      .leftJoin('questionbank.class', 'questionbankclass')
      .leftJoin('exam_set_class', 'esc', 'esc.exam_set_id = examset.id')
      .leftJoin('class', 'examclass', 'examclass.id = esc.class_id')
      .leftJoin(
        'class',
        'legacyexamclass',
        'legacyexamclass.id = examset.class_id',
      )
      .leftJoin(
        'grade',
        'grade',
        `grade.id = COALESCE(
          examclass.grade_id,
          legacyexamclass.grade_id,
          questionbankclass.grade_id
        )`,
      )
      .leftJoin(
        'subject',
        'subject',
        `subject.id = COALESCE(
          examclass.subject_id,
          legacyexamclass.subject_id,
          questionbankclass.subject_id
        )`,
      )
      .select('attempt.id', 'attemptId')
      .addSelect('user.full_name', 'studentName')
      .addSelect('user.user_name', 'userName')
      .addSelect('studentgroup.name', 'className')
      .addSelect('school.name', 'schoolName')
      .addSelect('attempt.submitted_at', 'submittedAt')
      .addSelect('attempt.score', 'score')
      .addSelect('subject.name', 'subjectName')
      .addSelect('questionbank.name', 'questionBankName')
      .addSelect('grade.code', 'gradeCode')
      .addSelect('grade.name', 'gradeName')
      .where('student.id = :studentId', { studentId })
      .andWhere('attempt.submitted_at IS NOT NULL')
      .andWhere('attempt.score >= :minCertificateScore', {
        minCertificateScore: 5,
      })
      .orderBy('attempt.submitted_at', 'DESC')
      .getRawMany<StudentCertificateRow>();

    const uniqueRows = new Map<string, StudentCertificateRow>();
    for (const row of rows) {
      if (!uniqueRows.has(row.attemptId)) {
        uniqueRows.set(row.attemptId, row);
      }
    }

    return [...uniqueRows.values()]
      .filter((row) => {
        const gradeNumber = this.getGradeNumber(row.gradeCode, row.gradeName);
        return gradeNumber !== null && gradeNumber >= 1 && gradeNumber <= 9;
      })
      .map((row, index) => {
        const score = Number(row.score);
        return {
          id: index + 1,
          name: row.studentName ?? row.userName,
          className: row.className ?? '',
          school: row.schoolName ?? '',
          date: this.formatCertificateDate(row.submittedAt),
          subject: row.subjectName ?? row.questionBankName ?? '',
          level:
            score >= 8
              ? CertificateLevel.GOOD_COMPLETION
              : CertificateLevel.COMPLETION,
        };
      });
  }

  private getGradeNumber(
    gradeCode?: string | null,
    gradeName?: string | null,
  ): number | null {
    const source = `${gradeCode ?? ''} ${gradeName ?? ''}`;
    const match = source.match(/\d+/);
    if (!match) {
      return null;
    }

    return Number(match[0]);
  }

  private formatCertificateDate(value: Date | string | null): string {
    if (!value) {
      return '';
    }

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }

    return date.toISOString().slice(0, 10);
  }

  /**
   * Cập nhật thời gian đăng nhập cuối
   */
  async updateLastLogin(id: string, ip?: string) {
    await this.repo.update(id, {
      lastLoginAt: new Date(),
      lastLoginIp: ip,
    });
  }

  /**
   * Vô hiệu hóa/kích hoạt tài khoản
   */
  async toggleDisabled(id: string, user?: JwtPayload) {
    const queryRunner = this.entityManager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const userRepo = queryRunner.manager.getRepository(UserEntity);
      const existingUser = await userRepo.findOne({ where: { id } });

      if (!existingUser) {
        throw new NotFoundException(
          ERROR_MESSAGES.NOT_FOUND(ENTITY_NAMES.USER),
        );
      }

      existingUser.isDisabled = !existingUser.isDisabled;
      existingUser.disabledAt = existingUser.isDisabled
        ? new Date()
        : undefined;
      existingUser.updatedBy = user?.userId;

      const result = await userRepo.save(existingUser);
      await queryRunner.commitTransaction();
      return result;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
