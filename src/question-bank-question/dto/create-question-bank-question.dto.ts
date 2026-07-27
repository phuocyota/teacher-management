import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsUUID,
  Min,
} from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';

export class CreateQuestionBankQuestionDto {
  @IsUUID()
  @IsNotEmpty()
  @ApiProperty({
    description: 'ID ngân hàng câu hỏi',
    example: '2233abe3-1961-4af5-a482-542f1227d844',
  })
  questionBankId!: string;

  @IsUUID()
  @IsNotEmpty()
  @ApiProperty({
    description: 'ID câu hỏi',
    example: '1233abe3-1961-4af5-a482-542f1227d844',
  })
  questionId!: string;

  @IsInt()
  @Min(1)
  @ApiProperty({
    description: 'Thứ tự câu hỏi trong ngân hàng câu hỏi',
    example: 1,
  })
  orderNo!: number;

  @IsNumber()
  @Min(0)
  @ApiProperty({
    description: 'Số điểm của câu hỏi',
    example: 2.5,
  })
  points!: number;

  @IsUUID()
  @IsOptional()
  @ApiProperty({
    description: 'ID phần đề thi chứa câu hỏi',
    required: false,
    nullable: true,
  })
  sectionId?: string | null;
}

export class UpdateQuestionBankQuestionDto extends PartialType(
  CreateQuestionBankQuestionDto,
) {}
