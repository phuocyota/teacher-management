import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsUUID,
  Min,
} from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';
import { AttemptStatus } from '../enum/attempt-status.enum';

export class CreateAttemptDto {
  @IsUUID()
  @IsNotEmpty()
  @ApiProperty({
    description: 'ID học sinh làm bài',
    example: '2233abe3-1961-4af5-a482-542f1227d844',
  })
  studentId!: string;

  @IsUUID()
  @IsNotEmpty()
  @ApiProperty({
    description: 'ID đề thi thuộc question bank',
    example: '3233abe3-1961-4af5-a482-542f1227d844',
  })
  questionBankId!: string;

  @IsUUID()
  @IsOptional()
  @ApiProperty({
    description: 'ID bộ đề thi',
    example: '4233abe3-1961-4af5-a482-542f1227d844',
    required: false,
    nullable: true,
  })
  examSetId?: string | null;

  @IsEnum(AttemptStatus)
  @IsOptional()
  @ApiProperty({
    description: 'Trạng thái bài làm',
    enum: AttemptStatus,
    example: AttemptStatus.DOING,
    required: false,
  })
  status?: AttemptStatus;

  @IsDateString()
  @IsNotEmpty()
  @ApiProperty({
    description: 'Thời điểm bắt đầu làm bài',
    example: '2026-03-03T09:00:00.000Z',
  })
  startedAt!: string;

  @IsDateString()
  @IsOptional()
  @ApiProperty({
    description: 'Thời điểm nộp bài',
    example: '2026-03-03T10:00:00.000Z',
    required: false,
  })
  submittedAt?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @ApiProperty({
    description: 'Tổng điểm sau khi chấm',
    example: 8.5,
    required: false,
  })
  score?: number;
}

export class UpdateAttemptDto extends PartialType(CreateAttemptDto) {}
