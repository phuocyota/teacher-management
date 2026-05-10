import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsOptional,
  IsUUID,
  Matches,
  Min,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { AttemptStatus } from 'src/attempt/enum/attempt-status.enum';
import { GroupType } from 'src/group/enum/group-type.enum';

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const UUID_OR_ALL_REGEX =
  /^(all|[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;

@ValidatorConstraint({ name: 'DateRange', async: false })
class DateRangeConstraint implements ValidatorConstraintInterface {
  validate(_: unknown, args: ValidationArguments): boolean {
    const object = args.object as { fromDate?: string; toDate?: string };
    return (
      !object.fromDate || !object.toDate || object.fromDate <= object.toDate
    );
  }

  defaultMessage(): string {
    return 'fromDate phai nho hon hoac bang toDate';
  }
}

class ReportDateRangeQueryDto {
  @ApiPropertyOptional({
    type: String,
    description: 'Ngay bat dau loc attempt (YYYY-MM-DD)',
  })
  @IsOptional()
  @Matches(ISO_DATE_REGEX, {
    message: 'fromDate phai theo dinh dang YYYY-MM-DD',
  })
  fromDate?: string;

  @ApiPropertyOptional({
    type: String,
    description: 'Ngay ket thuc loc attempt (YYYY-MM-DD)',
  })
  @IsOptional()
  @Matches(ISO_DATE_REGEX, {
    message: 'toDate phai theo dinh dang YYYY-MM-DD',
  })
  @Validate(DateRangeConstraint)
  toDate?: string;
}

export class StudentReportQueryDto extends ReportDateRangeQueryDto {
  @ApiPropertyOptional({
    type: String,
    description: 'ID nhom hoc sinh (student_group.id)',
  })
  @IsOptional()
  @Matches(UUID_OR_ALL_REGEX, { message: 'groupId khong hop le' })
  groupId?: string;

  @ApiPropertyOptional({
    type: String,
    description: 'Alias cua groupId',
  })
  @IsOptional()
  @Matches(UUID_OR_ALL_REGEX, { message: 'studentGroupId khong hop le' })
  studentGroupId?: string;

  @ApiPropertyOptional({
    type: String,
    description: 'ID khu vuc',
  })
  @IsOptional()
  @Matches(UUID_OR_ALL_REGEX, { message: 'zoneId khong hop le' })
  zoneId?: string;

  @ApiPropertyOptional({
    type: String,
    description: 'ID truong',
  })
  @IsOptional()
  @Matches(UUID_OR_ALL_REGEX, { message: 'schoolId khong hop le' })
  schoolId?: string;

  @ApiPropertyOptional({
    type: String,
    description: 'ID hoc sinh thuoc group, hoac all de xem tong hop',
  })
  @IsOptional()
  @Matches(UUID_OR_ALL_REGEX, { message: 'studentId khong hop le' })
  studentId?: string;

  @ApiPropertyOptional({
    type: Number,
    description: 'Trang lich su attempt',
    default: 1,
    minimum: 1,
  })
  @Type(() => Number)
  @IsInt({ message: 'page phai la so nguyen' })
  @Min(1, { message: 'page phai lon hon hoac bang 1' })
  page = 1;

  @ApiPropertyOptional({
    type: Number,
    description: 'So dong moi trang',
    default: 10,
    minimum: 1,
  })
  @Type(() => Number)
  @IsInt({ message: 'limit phai la so nguyen' })
  @Min(1, { message: 'limit phai lon hon hoac bang 1' })
  limit = 10;
}

export class AttemptReportFilterQueryDto extends ReportDateRangeQueryDto {
  @ApiPropertyOptional({
    type: String,
    description: 'Loc theo bo de',
  })
  @IsOptional()
  @IsUUID('4', { message: 'examSetId khong hop le' })
  examSetId?: string;

  @ApiPropertyOptional({
    type: String,
    description: 'Loc theo de thi/ngan hang cau hoi',
  })
  @IsOptional()
  @IsUUID('4', { message: 'questionBankId khong hop le' })
  questionBankId?: string;
}

export class ClassAttemptScoresExportQueryDto extends AttemptReportFilterQueryDto {
  @ApiProperty({
    type: String,
    description:
      'Danh sach ID lop/student_group, cach nhau boi dau phay. Moi lop la mot sheet.',
  })
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
      : value,
  )
  @IsArray({ message: 'groupIds phai la danh sach ID lop' })
  @ArrayNotEmpty({ message: 'groupIds la bat buoc' })
  @IsUUID('4', { each: true, message: 'groupId khong hop le' })
  groupIds!: string[];
}

export class StudentBestAttemptDetailExportQueryDto {
  @ApiProperty({
    type: String,
    description: 'ID hoc sinh',
  })
  @IsUUID('4', { message: 'userId khong hop le' })
  userId!: string;

  @ApiProperty({
    type: String,
    description: 'ID de thi/ngan hang cau hoi',
  })
  @IsUUID('4', { message: 'questionBankId khong hop le' })
  questionBankId!: string;
}

export class TeacherLeaderGroupDto {
  @ApiProperty({
    description: 'ID group',
    example: '5233abe3-1961-4af5-a482-542f1227d844',
  })
  id!: string;

  @ApiProperty({
    description: 'Ten group',
    example: 'Khoi 5A',
  })
  name!: string;

  @ApiProperty({
    description: 'Loai group',
    enum: GroupType,
    example: GroupType.PERSONAL,
  })
  type!: GroupType;
}

export class ReportStudentOptionDto {
  @ApiProperty({
    description: 'ID hoc sinh',
    example: '6233abe3-1961-4af5-a482-542f1227d844',
  })
  id!: string;

  @ApiPropertyOptional({
    description: 'Ho ten hoc sinh',
    example: 'Nguyen Van B',
    nullable: true,
  })
  fullName!: string | null;

  @ApiProperty({
    description: 'Ten dang nhap hoc sinh',
    example: 'student_b',
  })
  userName!: string;

  @ApiProperty({
    description: 'Ma hoc sinh',
    example: 'HS001',
  })
  code!: string;

  @ApiPropertyOptional({
    description: 'ID nhom hoc sinh',
    example: '7233abe3-1961-4af5-a482-542f1227d844',
    nullable: true,
  })
  studentGroupId!: string | null;

  @ApiPropertyOptional({
    description: 'Ten nhom hoc sinh',
    example: 'Lop 5A',
    nullable: true,
  })
  studentGroupName!: string | null;
}

export class StudentAttemptDto {
  @ApiProperty({
    description: 'ID lan lam bai',
    example: '8233abe3-1961-4af5-a482-542f1227d844',
  })
  attemptId!: string;

  @ApiProperty({
    description: 'ID de thi',
    example: '9233abe3-1961-4af5-a482-542f1227d844',
  })
  questionBankId!: string;

  @ApiProperty({
    description: 'Ten de thi',
    example: 'De thi hoc ky 1',
  })
  questionBankName!: string;

  @ApiProperty({
    description: 'ID bo de',
    example: 'a233abe3-1961-4af5-a482-542f1227d844',
  })
  examSetId!: string;

  @ApiProperty({
    description: 'Ten bo de',
    example: 'Bo de tuan 1',
  })
  examSetName!: string;

  @ApiProperty({
    description: 'Trang thai lan lam',
    enum: AttemptStatus,
    example: AttemptStatus.SUBMITTED,
  })
  status!: AttemptStatus;

  @ApiProperty({
    description: 'Thoi diem bat dau',
    example: '2026-03-03T09:00:00.000Z',
  })
  startedAt!: Date;

  @ApiPropertyOptional({
    description: 'Thoi diem nop bai',
    example: '2026-03-03T09:30:00.000Z',
    nullable: true,
  })
  submittedAt!: Date | null;

  @ApiPropertyOptional({
    description: 'Diem bai lam',
    example: 8.5,
    nullable: true,
  })
  score!: number | null;

  @ApiPropertyOptional({
    description: 'ID hoc sinh',
    example: '6233abe3-1961-4af5-a482-542f1227d844',
    nullable: true,
  })
  studentId?: string | null;

  @ApiPropertyOptional({
    description: 'Ten hoc sinh',
    example: 'Nguyen Van B',
    nullable: true,
  })
  studentName?: string | null;

  @ApiPropertyOptional({
    description: 'Ma hoc sinh',
    example: 'HS001',
    nullable: true,
  })
  studentCode?: string | null;
}

export class StudentReportSummaryDto {
  @ApiProperty({
    description: 'Tong so lan lam trong khoang thoi gian',
    example: 12,
  })
  totalAttempts!: number;

  @ApiPropertyOptional({
    description: 'Diem trung binh cua cac lan da co diem',
    example: 7.8,
    nullable: true,
  })
  averageScore!: number | null;

  @ApiPropertyOptional({
    description: 'Diem cao nhat',
    example: 9.5,
    nullable: true,
  })
  highestScore!: number | null;

  @ApiPropertyOptional({
    description: 'Lan lam gan nhat',
    example: '2026-03-03T09:30:00.000Z',
    nullable: true,
  })
  latestAttemptAt!: Date | null;
}

export class StudentScoreTrendPointDto {
  @ApiProperty({
    description: 'Ngay thong ke',
    example: '2026-03-03',
  })
  date!: string;

  @ApiProperty({
    description: 'So lan lam trong ngay',
    example: 2,
  })
  attemptCount!: number;

  @ApiPropertyOptional({
    description: 'Diem trung binh trong ngay',
    example: 8.25,
    nullable: true,
  })
  averageScore!: number | null;

  @ApiPropertyOptional({
    description: 'Diem cao nhat trong ngay',
    example: 9.5,
    nullable: true,
  })
  highestScore!: number | null;
}

export class StudentReportDto {
  @ApiProperty({
    description: 'ID group duoc chon',
    example: '5233abe3-1961-4af5-a482-542f1227d844',
    nullable: true,
  })
  groupId!: string | null;

  @ApiPropertyOptional({
    description: 'Thong tin hoc sinh',
    type: ReportStudentOptionDto,
    nullable: true,
  })
  student!: ReportStudentOptionDto | null;

  @ApiPropertyOptional({
    description: 'ID khu vuc duoc loc',
    example: '9233abe3-1961-4af5-a482-542f1227d844',
    nullable: true,
  })
  zoneId?: string | null;

  @ApiPropertyOptional({
    description: 'ID truong duoc loc',
    example: 'a233abe3-1961-4af5-a482-542f1227d844',
    nullable: true,
  })
  schoolId?: string | null;

  @ApiPropertyOptional({
    description: 'Ngay bat dau loc',
    example: '2026-03-01',
    nullable: true,
  })
  fromDate!: string | null;

  @ApiPropertyOptional({
    description: 'Ngay ket thuc loc',
    example: '2026-03-31',
    nullable: true,
  })
  toDate!: string | null;

  @ApiProperty({
    description: 'Tong quan bao cao',
    type: StudentReportSummaryDto,
  })
  summary!: StudentReportSummaryDto;

  @ApiProperty({
    description: 'Du lieu xu huong diem theo ngay',
    type: [StudentScoreTrendPointDto],
  })
  trend!: StudentScoreTrendPointDto[];

  @ApiProperty({
    description: 'Danh sach lich su lam bai',
    type: [StudentAttemptDto],
  })
  attempts!: StudentAttemptDto[];

  @ApiProperty({
    description: 'Trang hien tai',
    example: 1,
  })
  page!: number;

  @ApiProperty({
    description: 'So dong moi trang',
    example: 10,
  })
  limit!: number;

  @ApiProperty({
    description: 'Tong so lan lam tim thay',
    example: 35,
  })
  total!: number;
}
