import { ApiProperty } from '@nestjs/swagger';
import { BaseDto } from 'src/common/dto/base.dto';
import { PaginationResponseDto } from 'src/common/dto/pagination.dto';
import { AttemptStatus } from '../enum/attempt-status.enum';

export class AttemptResponseDto extends BaseDto {
  @ApiProperty({
    description: 'ID hoc sinh lam bai',
    example: '2233abe3-1961-4af5-a482-542f1227d844',
    nullable: true,
  })
  studentId!: string | null;

  @ApiProperty({
    description: 'Tên người làm bài từ bên ngoài hệ thống',
    example: 'Nguyễn Văn A',
    required: false,
    nullable: true,
  })
  guestName?: string | null;

  @ApiProperty({
    description: 'ID de thi thuoc question bank',
    example: '3233abe3-1961-4af5-a482-542f1227d844',
  })
  questionBankId!: string;

  @ApiProperty({
    description: 'ID bo de thi',
    example: '4233abe3-1961-4af5-a482-542f1227d844',
    required: false,
    nullable: true,
  })
  examSetId?: string | null;

  @ApiProperty({
    description: 'Trang thai bai lam',
    enum: AttemptStatus,
    example: AttemptStatus.DOING,
  })
  status!: AttemptStatus;

  @ApiProperty({
    description: 'Thoi diem bat dau lam bai',
    example: '2026-03-03T09:00:00.000Z',
  })
  startedAt!: Date;

  @ApiProperty({
    description: 'Thoi diem nop bai',
    example: '2026-03-03T10:00:00.000Z',
    required: false,
  })
  submittedAt?: Date;

  @ApiProperty({
    description: 'Tong diem sau khi cham',
    example: 8.5,
    required: false,
  })
  score?: number;

  @ApiProperty({
    description: 'Thang diem toi da cua de thi',
    example: 10,
    required: false,
  })
  fullScore?: number;
}

export class AttemptListResponseDto extends PaginationResponseDto<AttemptResponseDto> {
  @ApiProperty({
    description: 'Danh sach bai lam',
    type: [AttemptResponseDto],
  })
  declare data: AttemptResponseDto[];
}

export class AttemptExamHistoryItemDto {
  @ApiProperty({
    description: 'Ngay lam bai (YYYY-MM-DD)',
    example: '2026-03-03',
  })
  date!: string;

  @ApiProperty({
    description: 'ID de thi',
    example: '3233abe3-1961-4af5-a482-542f1227d844',
  })
  questionBankId!: string;

  @ApiProperty({
    description: 'ID bo de thi',
    example: '4233abe3-1961-4af5-a482-542f1227d844',
    required: false,
    nullable: true,
  })
  examSetId?: string | null;

  @ApiProperty({
    description: 'Ten bai thi',
    example: 'De thi hoc ky 1',
  })
  examName!: string;

  @ApiProperty({
    description: 'So lan lam bai trong cung ngay va cung bai thi',
    example: 2,
  })
  attemptCount!: number;
}

export class AttemptStatisticsDto {
  @ApiProperty({
    description: 'Tong so de da lam',
    example: 52,
  })
  totalAttempts!: number;

  @ApiProperty({
    description: 'Diem trung binh',
    example: 8.5,
    type: Number,
    nullable: true,
  })
  averageScore?: number | null;

  @ApiProperty({
    description: 'Diem cao nhat',
    example: 10.0,
    type: Number,
    nullable: true,
  })
  highestScore?: number | null;

  @ApiProperty({
    description: 'Xep hang theo percentile (0-100)',
    example: 90,
    type: Number,
    nullable: true,
  })
  percentileRank?: number | null;
}
