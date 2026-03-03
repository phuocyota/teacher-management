import { ApiProperty } from '@nestjs/swagger';
import { BaseDto } from 'src/common/dto/base.dto';
import { PaginationResponseDto } from 'src/common/dto/pagination.dto';
import { AttemptStatus } from '../enum/attempt-status.enum';

export class AttemptResponseDto extends BaseDto {
  @ApiProperty({
    description: 'ID học sinh làm bài',
    example: '2233abe3-1961-4af5-a482-542f1227d844',
  })
  studentId!: string;

  @ApiProperty({
    description: 'ID đề thi thuộc question bank',
    example: '3233abe3-1961-4af5-a482-542f1227d844',
  })
  questionBankId!: string;

  @ApiProperty({
    description: 'Trạng thái bài làm',
    enum: AttemptStatus,
    example: AttemptStatus.DOING,
  })
  status!: AttemptStatus;

  @ApiProperty({
    description: 'Thời điểm bắt đầu làm bài',
    example: '2026-03-03T09:00:00.000Z',
  })
  startedAt!: Date;

  @ApiProperty({
    description: 'Thời điểm nộp bài',
    example: '2026-03-03T10:00:00.000Z',
    required: false,
  })
  submittedAt?: Date;

  @ApiProperty({
    description: 'Tổng điểm sau khi chấm',
    example: 8.5,
    required: false,
  })
  score?: number;
}

export class AttemptListResponseDto extends PaginationResponseDto<AttemptResponseDto> {
  @ApiProperty({
    description: 'Danh sách bài làm',
    type: [AttemptResponseDto],
  })
  declare data: AttemptResponseDto[];
}
