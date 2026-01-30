import { IsNotEmpty, IsString, IsEnum, IsUUID } from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';
import { ContentTypes } from 'src/common/enum/content-type.enum';

export class CreateQuestionDto {
  @IsEnum(ContentTypes)
  @IsNotEmpty()
  @ApiProperty({
    description: 'Loai dữ liệu của câu hỏi',
    enum: ContentTypes,
    example: ContentTypes.TEXT,
  })
  questionType!: ContentTypes;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    description: 'Nội dung của câu hỏi',
    example: 'What is the capital of France?',
  })
  content!: string;

  @IsUUID()
  @IsNotEmpty()
  @ApiProperty({
    description: 'ID Ngân hàng câu hỏi mà câu hỏi thuộc về',
    example: '2233abe3-1961-4af5-a482-542f1227d844',
  })
  questionBankId!: string;
}

export class UpdateQuestionDto extends PartialType(CreateQuestionDto) {}
