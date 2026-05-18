import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Workbook } from 'exceljs';
import { Repository } from 'typeorm';
import { SchoolEntity } from './school.entity';
import { UserEntity } from 'src/user/user.entity';
import { UserType } from 'src/common/enum/user-type.enum';
import { CreateSchoolDto, UpdateSchoolDto } from './dto/create-school.dto';
import {
  ERROR_MESSAGES,
  ENTITY_NAMES,
} from 'src/common/constant/error-messages.constant';
import { PaginationResponseDto } from 'src/common/dto/pagination.dto';
import { SchoolResponseDto } from './dto/school.dto';
import { autoMapListToDto } from 'src/common/utils/auto-map.util';
import { ZoneService } from 'src/zone/zone.service';
import { StudentGroupEntity } from 'src/student-group/student-group.entity';
import { StudentGroupResponseDto } from 'src/student-group/dto/student-group.dto';
import { GroupMemberRole } from 'src/user-group/enum/group-member-role.enum';
import { StudentEntity } from 'src/student/student.entity';

const DEFAULT_STUDENT_PASSWORD = '123456';

interface StudentAccountExportRow {
  studentGroupName: string | null;
  fullName: string | null;
  userName: string;
}

@Injectable()
export class SchoolService {
  constructor(
    @InjectRepository(SchoolEntity)
    private readonly schoolRepo: Repository<SchoolEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(StudentEntity)
    private readonly studentRepo: Repository<StudentEntity>,
    @InjectRepository(StudentGroupEntity)
    private readonly studentGroupRepo: Repository<StudentGroupEntity>,
    private readonly zoneService: ZoneService,
  ) {}

  private async ensurePrincipalUserExists(
    principalUserId?: string | null,
  ): Promise<UserEntity | null> {
    if (!principalUserId) {
      return null;
    }

    const user = await this.userRepo.findOne({
      where: { id: principalUserId },
    });

    if (!user) {
      throw new NotFoundException(
        ERROR_MESSAGES.NOT_FOUND_WITH_ID(
          ENTITY_NAMES.USER ?? 'Người dùng',
          principalUserId,
        ),
      );
    }

    return user;
  }

  async create(dto: CreateSchoolDto): Promise<SchoolEntity> {
    const existingSchool = await this.schoolRepo.findOne({
      where: { code: dto.code },
    });

    if (existingSchool) {
      throw new ConflictException('Mã trường học đã tồn tại');
    }

    const zone = dto.zoneId ? await this.zoneService.findOne(dto.zoneId) : null;
    const principalUser = await this.ensurePrincipalUserExists(
      dto.principalUserId,
    );

    const record = this.schoolRepo.create({
      code: dto.code,
      name: dto.name,
      zoneId: dto.zoneId ?? null,
      zone,
      principalUserId: dto.principalUserId ?? null,
      principalUser,
      address: dto.address,
    });
    return this.schoolRepo.save(record);
  }

  async findAll(
    page = 1,
    size = 10,
    search?: string,
    code?: string,
    zoneId?: string,
  ): Promise<PaginationResponseDto<SchoolResponseDto>> {
    const skip = (page - 1) * size;

    const qb = this.schoolRepo
      .createQueryBuilder('school')
      .leftJoinAndSelect('school.zone', 'zone')
      .leftJoinAndSelect('school.principalUser', 'principalUser');

    if (search) {
      qb.andWhere('(school.name ILIKE :search OR school.code ILIKE :search)', {
        search: `%${search}%`,
      });
    }

    if (code) {
      qb.andWhere('school.code = :code', { code });
    }

    if (zoneId) {
      qb.andWhere('school.zoneId = :zoneId', { zoneId });
    }

    qb.orderBy('school.createdAt', 'DESC');
    qb.skip(skip).take(size);

    const [data, total] = await qb.getManyAndCount();

    return {
      data: this.mapSchoolsToResponse(data),
      page,
      size,
      total,
    };
  }

  async findOne(id: string): Promise<SchoolEntity> {
    const record = await this.schoolRepo.findOne({
      where: { id },
      relations: ['zone', 'principalUser'],
    });

    if (!record) {
      throw new NotFoundException(
        ERROR_MESSAGES.NOT_FOUND_WITH_ID(
          ENTITY_NAMES.SCHOOL ?? 'Trường học',
          id,
        ),
      );
    }

    return record;
  }

  async findStudentGroupsBySchool(
    schoolId: string,
    userId: string,
  ): Promise<StudentGroupResponseDto[]> {
    await this.findOne(schoolId);

    const studentGroups = await this.studentGroupRepo
      .createQueryBuilder('studentGroup')
      .innerJoin('studentGroup.school', 'school')
      .where('studentGroup.schoolId = :schoolId', { schoolId })
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
          userId,
          leaderRole: GroupMemberRole.LEADER,
        },
      )
      .orderBy('studentGroup.code', 'ASC')
      .addOrderBy('studentGroup.name', 'ASC')
      .getMany();

    return autoMapListToDto(StudentGroupResponseDto, studentGroups);
  }

  async exportStudentAccountsExcel(
    schoolId: string,
  ): Promise<{ fileName: string; buffer: Buffer }> {
    const school = await this.findOne(schoolId);
    const rows = await this.getStudentAccountExportRows(schoolId);

    const workbook = new Workbook();
    workbook.creator = 'teacher-management';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Tai khoan hoc sinh');
    worksheet.columns = [
      { header: 'STT', key: 'index', width: 8 },
      { header: 'Lop', key: 'studentGroupName', width: 18 },
      { header: 'Ten', key: 'fullName', width: 32 },
      { header: 'Tai khoan', key: 'userName', width: 24 },
      { header: 'Mat khau', key: 'password', width: 14 },
    ];

    const titleRow = worksheet.insertRow(1, [
      `DANH SACH TAI KHOAN HOC SINH - ${school.name}`,
    ]);
    worksheet.mergeCells(1, 1, 1, 5);
    titleRow.font = { bold: true, size: 14 };
    titleRow.alignment = { horizontal: 'center', vertical: 'middle' };
    titleRow.height = 24;

    const exportedAtRow = worksheet.insertRow(2, [
      `Ngay xuat: ${this.formatDateTime(new Date())}`,
    ]);
    worksheet.mergeCells(2, 1, 2, 5);
    exportedAtRow.alignment = { horizontal: 'right' };
    exportedAtRow.font = { italic: true, size: 10 };

    const headerRow = worksheet.getRow(3);
    headerRow.font = { bold: true };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD9EAF7' },
      };
      cell.border = this.thinBorder();
    });

    rows.forEach((row, index) => {
      const dataRow = worksheet.addRow({
        index: index + 1,
        studentGroupName: row.studentGroupName ?? '',
        fullName: row.fullName ?? '',
        userName: row.userName,
        password: DEFAULT_STUDENT_PASSWORD,
      });
      dataRow.eachCell((cell) => {
        cell.border = this.thinBorder();
        cell.alignment = { vertical: 'middle' };
      });
      dataRow.getCell(1).alignment = {
        horizontal: 'center',
        vertical: 'middle',
      };
    });

    worksheet.views = [{ state: 'frozen', ySplit: 3 }];

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return {
      fileName: `${this.toSafeFileName(school.name)}-tai-khoan-hoc-sinh.xlsx`,
      buffer: Buffer.from(arrayBuffer),
    };
  }

  private async getStudentAccountExportRows(
    schoolId: string,
  ): Promise<StudentAccountExportRow[]> {
    return this.studentRepo
      .createQueryBuilder('student')
      .innerJoin(UserEntity, 'user', 'user.id = student.id')
      .leftJoin('student.studentGroup', 'studentGroup')
      .select('studentGroup.name', 'studentGroupName')
      .addSelect('studentGroup.code', 'studentGroupCode')
      .addSelect('user.full_name', 'fullName')
      .addSelect('user.user_name', 'userName')
      .where(
        '(student.school_id = :schoolId OR studentGroup.schoolId = :schoolId)',
        { schoolId },
      )
      .andWhere('user.user_type = :userType', { userType: UserType.STUDENT })
      .orderBy('studentGroup.code', 'ASC')
      .addOrderBy('studentGroup.name', 'ASC')
      .addOrderBy('COALESCE(user.full_name, user.user_name)', 'ASC')
      .getRawMany<StudentAccountExportRow>();
  }

  async update(id: string, dto: UpdateSchoolDto): Promise<SchoolEntity> {
    const record = await this.findOne(id);

    if (dto.code !== undefined && dto.code !== record.code) {
      const existingSchool = await this.schoolRepo.findOne({
        where: { code: dto.code },
      });

      if (existingSchool) {
        throw new ConflictException('Mã trường học đã tồn tại');
      }
      record.code = dto.code;
    }

    if (dto.name !== undefined) {
      record.name = dto.name;
    }

    if (dto.zoneId !== undefined) {
      record.zone = dto.zoneId
        ? await this.zoneService.findOne(dto.zoneId)
        : null;
      record.zoneId = dto.zoneId ?? null;
    }

    if (dto.principalUserId !== undefined) {
      record.principalUser = await this.ensurePrincipalUserExists(
        dto.principalUserId,
      );
      record.principalUserId = dto.principalUserId ?? null;
    }

    if (dto.address !== undefined) {
      record.address = dto.address;
    }

    return this.schoolRepo.save(record);
  }

  async remove(id: string): Promise<void> {
    const record = await this.findOne(id);
    await this.schoolRepo.remove(record);
  }

  private mapSchoolsToResponse(schools: SchoolEntity[]): SchoolResponseDto[] {
    return autoMapListToDto(
      SchoolResponseDto,
      schools.map((school) => ({
        ...school,
        zoneName: school.zone?.name ?? null,
        principalUserName: school.principalUser?.fullName ?? null,
      })),
    );
  }

  private thinBorder() {
    return {
      top: { style: 'thin' as const },
      left: { style: 'thin' as const },
      bottom: { style: 'thin' as const },
      right: { style: 'thin' as const },
    };
  }

  private formatDateTime(date: Date): string {
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${pad(date.getDate())}/${pad(
      date.getMonth() + 1,
    )}/${date.getFullYear()} ${pad(date.getHours())}:${pad(
      date.getMinutes(),
    )}`;
  }

  private toSafeFileName(value: string): string {
    return (
      value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'school'
    );
  }
}
