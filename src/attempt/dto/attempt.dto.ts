import { ApiProperty } from '@nestjs/swagger';
import { BaseDto } from 'src/common/dto/base.dto';
import { PaginationResponseDto } from 'src/common/dto/pagination.dto';
import { AttemptStatus } from '../enum/attempt-status.enum';

export class AttemptResponseDto extends BaseDto {
  @ApiProperty({
    description: 'ID hoc sinh lam bai',
    example: '2233abe3-1961-4af5-a482-542f1227d844',
  })
  studentId!: string;

  @ApiProperty({
    description: 'ID de thi thuoc question bank',
    example: '3233abe3-1961-4af5-a482-542f1227d844',
  })
  questionBankId!: string;

  @ApiProperty({
    description: 'ID bo de thi',
    example: '4233abe3-1961-4af5-a482-542f1227d844',
  })
  examSetId!: string;

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
