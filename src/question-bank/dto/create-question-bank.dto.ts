import { IsNotEmpty, IsInt, IsDateString, IsUUID, Min } from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';

export class CreateQuestionBankDto {
  @IsInt()
  @IsNotEmpty()
  @Min(0)
  @ApiProperty({
    description: 'Tổng điểm của kỳ thi',
    example: 100,
  })
  totalMarks!: number;

  @IsDateString()
  @IsNotEmpty()
  @ApiProperty({
    description: 'Ngày diễn ra kỳ thi (định dạng YYYY-MM-DD)',
    example: '2026-02-15',
  })
  examDate!: string;

  @IsUUID()
  @IsNotEmpty()
  @ApiProperty({
    description: 'ID lớp học mà ngân hàng câu hỏi thuộc về',
    example: '2233abe3-1961-4af5-a482-542f1227d844',
  })
  classId!: string;
}

export class UpdateQuestionBankDto extends PartialType(CreateQuestionBankDto) {}
