import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, IsUUID, Min } from 'class-validator';

export class AddQuestionToQuestionBankDto {
  @IsUUID()
  @ApiProperty({
    description: 'ID câu hỏi cần thêm vào ngân hàng câu hỏi',
    example: '1233abe3-1961-4af5-a482-542f1227d844',
  })
  questionId!: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  @ApiProperty({
    description:
      'Thứ tự câu hỏi trong ngân hàng câu hỏi (mặc định thêm vào cuối)',
    example: 12,
    required: false,
  })
  orderNo?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @ApiProperty({
    description: 'Số điểm của câu hỏi (mặc định = 0)',
    example: 2.5,
    required: false,
  })
  points?: number;

  @IsUUID()
  @IsOptional()
  @ApiProperty({
    description: 'ID phần đề thi chứa câu hỏi',
    required: false,
    nullable: true,
  })
  sectionId?: string | null;
}
