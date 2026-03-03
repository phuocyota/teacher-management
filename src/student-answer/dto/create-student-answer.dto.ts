import { ApiProperty, PartialType } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateStudentAnswerDto {
  @IsUUID()
  @ApiProperty({
    description: 'ID lần làm bài',
    example: '2233abe3-1961-4af5-a482-542f1227d844',
  })
  attemptId!: string;

  @IsUUID()
  @ApiProperty({
    description: 'ID câu hỏi',
    example: '3233abe3-1961-4af5-a482-542f1227d844',
  })
  questionId!: string;

  @IsUUID()
  @IsOptional()
  @ApiProperty({
    description: 'ID đáp án được chọn cho câu hỏi trắc nghiệm một đáp án',
    example: '4233abe3-1961-4af5-a482-542f1227d844',
    required: false,
  })
  answerId?: string;

  @IsString()
  @IsOptional()
  @ApiProperty({
    description: 'Mô tả hoặc ghi chú thêm cho câu trả lời',
    example: 'Học sinh chọn đáp án dựa trên hình minh họa',
    required: false,
  })
  description?: string;

  @IsString()
  @IsOptional()
  @ApiProperty({
    description: 'Nội dung tự luận hoặc đáp án điền vào',
    example: 'Hà Nội',
    required: false,
  })
  textValue?: string;

  @IsBoolean()
  @IsOptional()
  @ApiProperty({
    description: 'Đúng hay sai sau khi nộp bài',
    example: true,
    required: false,
  })
  isCorrect?: boolean;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @ApiProperty({
    description: 'Số điểm đạt được cho câu này',
    example: 1,
    required: false,
  })
  pointsEarned?: number;

  @IsArray()
  @IsUUID(undefined, { each: true })
  @IsOptional()
  @ApiProperty({
    description: 'Danh sách ID đáp án được chọn cho câu hỏi nhiều đáp án',
    example: [
      '5233abe3-1961-4af5-a482-542f1227d844',
      '6233abe3-1961-4af5-a482-542f1227d844',
    ],
    required: false,
  })
  selectedAnswerIds?: string[];

  @IsInt()
  @Min(0)
  @IsOptional()
  @ApiProperty({
    description: 'Thời gian làm câu hỏi tính theo giây',
    example: 45,
    required: false,
  })
  timeSpentSec?: number;
}

export class UpdateStudentAnswerDto extends PartialType(
  CreateStudentAnswerDto,
) {}
