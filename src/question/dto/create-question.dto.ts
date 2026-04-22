import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  IsObject,
} from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';
import { ContentTypes } from 'src/common/enum/content-type.enum';
import { QuestionType } from '../enum/question-type.enum';

export class CreateQuestionDto {
  @IsOptional()
  @IsEnum(QuestionType)
  @ApiProperty({
    description: 'Loai cau hoi',
    enum: QuestionType,
    example: QuestionType.SINGLE_CHOICE,
    required: false,
    default: QuestionType.SINGLE_CHOICE,
  })
  type?: QuestionType;

  @IsEnum(ContentTypes)
  @IsNotEmpty()
  @ApiProperty({
    description: 'Loai du lieu cua cau hoi',
    enum: ContentTypes,
    example: ContentTypes.TEXT,
  })
  contentType!: ContentTypes;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    description: 'Noi dung cua cau hoi',
    example: 'What is the capital of France?',
  })
  content!: string;

  @IsObject()
  @IsOptional()
  @ApiProperty({
    description: 'Metadata mo rong cho cac kieu cau hoi dac biet',
    required: false,
    type: Object,
    additionalProperties: true,
  })
  meta?: Record<string, unknown>;

  @IsUUID()
  @IsOptional()
  @ApiProperty({
    description: 'Noi dung tiep theo sau cau hoi neu cau hoi co chuoi noi dung',
    example: '550e8400-e29b-41d4-a716-446655440000',
    required: false,
  })
  nextContent?: string;

  @IsUUID()
  @IsOptional()
  @ApiProperty({
    description: 'ID cau hoi truoc do. Neu co thi cau hoi moi se duoc gan vao nextContent cua cau hoi nay',
    example: '550e8400-e29b-41d4-a716-446655440001',
    required: false,
  })
  previousId?: string;
}

export class UpdateQuestionDto extends PartialType(CreateQuestionDto) {
  @IsUUID()
  @IsOptional()
  @ApiProperty({
    description: 'ID question bank dung de cap nhat lien ket question_bank_question',
    example: '2233abe3-1961-4af5-a482-542f1227d844',
    required: false,
  })
  questionBankId?: string;
}
