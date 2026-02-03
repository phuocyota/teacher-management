import { IsNotEmpty, IsString, IsEnum, IsUUID } from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';
import { ContentTypes } from 'src/common/enum/content-type.enum';

export class CreateQuestionDto {
  @IsEnum(ContentTypes)
  @IsNotEmpty()
  @ApiProperty({
    description: 'Loại dữ liệu của câu hỏi',
    enum: ContentTypes,
    example: ContentTypes.TEXT,
  })
  contentType!: ContentTypes;

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

  @IsUUID()
  @ApiProperty({
    description:
      'Nội dung tiếp theo sau câu hỏi (nếu câu hỏi đó vừa hình vừa chữ xen kẽ nhau)',
    example: '550e8400-e29b-41d4-a716-446655440000',
    required: false,
  })
  nextContent?: string;
}

export class UpdateQuestionDto extends PartialType(CreateQuestionDto) {}
