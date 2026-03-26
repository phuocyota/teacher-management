import { ApiProperty } from '@nestjs/swagger';
import { BaseDto } from 'src/common/dto/base.dto';
import { PaginationResponseDto } from 'src/common/dto/pagination.dto';
import { ExamSetStatus } from '../enum/exam-set-status.enum';

export class ExamSetResponseDto extends BaseDto {
  @ApiProperty({
    description: 'Ten bo de thi',
    example: 'Bo de thi hoc ky 1',
  })
  name!: string;

  @ApiProperty({
    description: 'Mo ta bo de thi',
    example: 'Bo de danh cho lop 10A1 mon Toan',
    required: false,
  })
  description?: string;

  @ApiProperty({
    description: 'Hinh anh bo de thi',
    example: 'https://example.com/exam-set-image.jpg',
    required: false,
  })
  image?: string;

  @ApiProperty({
    description: 'ID lop hoc',
    example: '2233abe3-1961-4af5-a482-542f1227d844',
    required: false,
  })
  classId?: string;

  @ApiProperty({
    description: 'Trang thai bo de',
    example: ExamSetStatus.DRAFT,
    enum: ExamSetStatus,
  })
  status!: ExamSetStatus;
}

export class ExamSetDetailQuestionBankDto {
  @ApiProperty({
    description: 'ID de thi (question bank)',
    example: '2233abe3-1961-4af5-a482-542f1227d844',
  })
  id!: string;

  @ApiProperty({
    description: 'Tieu de de thi',
    example: 'De 01 - 45p',
  })
  title!: string;

  @ApiProperty({
    description: 'Thoi gian lam bai (giay)',
    example: 2700,
    nullable: true,
  })
  durationSeconds!: number | null;

  @ApiProperty({
    description: 'Tong so cau hoi',
    example: 40,
    nullable: true,
  })
  totalQuestions!: number | null;

  @ApiProperty({
    description: 'So lan lam bai toi da',
    example: 3,
    nullable: true,
  })
  maxAttempts!: number | null;

  @ApiProperty({
    description: 'Tong diem',
    example: 10,
    nullable: true,
  })
  totalPoints!: number | null;

  @ApiProperty({
    description: 'Do kho de thi',
    example: 'medium',
    nullable: true,
  })
  difficulty!: string | null;

  @ApiProperty({
    description: 'Trang thai de thi',
    example: 'published',
    nullable: true,
  })
  status!: string | null;

  @ApiProperty({
    description: 'Thoi gian tao',
    example: '2026-03-01T00:00:00.000Z',
  })
  createdAt!: Date;
}

export class ExamSetDetailStatsDto {
  @ApiProperty({
    description: 'So luong de thi trong bo de',
    example: 1,
  })
  questionBankCount!: number;
}

export class ExamSetDetailResponseDto extends ExamSetResponseDto {
  @ApiProperty({
    description: 'ID mon hoc',
    example: '2233abe3-1961-4af5-a482-542f1227d844',
    required: false,
    nullable: true,
  })
  subjectId?: string | null;

  @ApiProperty({
    description: 'ID khoi',
    example: '2233abe3-1961-4af5-a482-542f1227d844',
    required: false,
    nullable: true,
  })
  gradeId?: string | null;

  @ApiProperty({
    description: 'Danh sach de thi thuoc bo de',
    type: [ExamSetDetailQuestionBankDto],
  })
  questionBanks!: ExamSetDetailQuestionBankDto[];

  @ApiProperty({
    description: 'Thong ke cua bo de',
    type: ExamSetDetailStatsDto,
  })
  stats!: ExamSetDetailStatsDto;
}

export class ExamSetOptionDto {
  @ApiProperty({
    description: 'Exam set ID used as option value',
    example: '2233abe3-1961-4af5-a482-542f1227d844',
  })
  value!: string;

  @ApiProperty({
    description: 'Exam set name used as option label',
    example: 'Bo de 1',
  })
  label!: string;

  @ApiProperty({
    description: 'Exam set name',
    example: 'Bo de 1',
  })
  name!: string;

  @ApiProperty({
    description: 'Related class ID',
    example: '3233abe3-1961-4af5-a482-542f1227d844',
    required: false,
  })
  classId?: string;

  @ApiProperty({
    description: 'Exam set status',
    example: ExamSetStatus.DRAFT,
    enum: ExamSetStatus,
  })
  status!: ExamSetStatus;
}

export class ExamSetClassOptionDto {
  @ApiProperty({
    description: 'Class ID used as option value',
    example: '3233abe3-1961-4af5-a482-542f1227d844',
  })
  value!: string;

  @ApiProperty({
    description: 'Class name used as option label',
    example: 'Lop 1',
  })
  label!: string;

  @ApiProperty({
    description: 'Class code',
    example: 'L1',
  })
  code!: string;

  @ApiProperty({
    description: 'Class name',
    example: 'Lop 1',
  })
  name!: string;
}

export class ExamSetOptionsResponseDto {
  @ApiProperty({
    description: 'Danh sach lop hoc cho combobox',
    type: [ExamSetClassOptionDto],
  })
  classes!: ExamSetClassOptionDto[];

  @ApiProperty({
    description: 'Danh sach bo de thi cho combobox',
    type: [ExamSetOptionDto],
  })
  examSets!: ExamSetOptionDto[];
}

export class ExamSetListResponseDto extends PaginationResponseDto<ExamSetResponseDto> {
  @ApiProperty({
    description: 'Danh sach bo de thi',
    type: [ExamSetResponseDto],
  })
  declare data: ExamSetResponseDto[];
}
