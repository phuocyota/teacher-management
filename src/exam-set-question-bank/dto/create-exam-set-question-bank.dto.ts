import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsUUID, Min } from 'class-validator';

export class CreateExamSetQuestionBankDto {
  @IsUUID()
  @IsNotEmpty()
  @ApiProperty({
    description: 'ID bo de thi',
    example: '2233abe3-1961-4af5-a482-542f1227d844',
  })
  examSetId!: string;

  @IsUUID()
  @IsNotEmpty()
  @ApiProperty({
    description: 'ID ngan hang cau hoi',
    example: 'a6fd0f8e-b2bf-4fe8-8be1-1062f27822da',
  })
  questionBankId!: string;

  @IsInt()
  @Min(1)
  @ApiProperty({
    description: 'Thu tu sap xep',
    example: 1,
  })
  order!: number;
}

export class UpdateExamSetQuestionBankDto extends PartialType(
  CreateExamSetQuestionBankDto,
) {}
