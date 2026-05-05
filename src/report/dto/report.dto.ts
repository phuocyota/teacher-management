import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AttemptStatus } from 'src/attempt/enum/attempt-status.enum';
import { GroupType } from 'src/group/enum/group-type.enum';

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
