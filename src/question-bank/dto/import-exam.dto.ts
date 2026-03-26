import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';
import { ContentTypes } from 'src/common/enum/content-type.enum';
import { QuestionType } from 'src/question/enum/question-type.enum';

export class ImportExamDto {
  @ApiProperty({
    description: 'ID question bank de import cau hoi vao',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsNotEmpty()
  questionBankId!: string;
}

export interface ParsedAnswer {
  content: string;
  contentType: ContentTypes;
  isCorrect?: boolean;
  answerParts?: ContentPart[];
}

export interface ContentPart {
  content: string;
  contentType: ContentTypes;
}

export class ParsedQuestion {
  content: string;
  contentType: ContentTypes;
  type?: QuestionType;
  answers: ParsedAnswer[];
  correctAnswer?: number;
  contentParts?: ContentPart[];
}

export class ImportExamQuestionSummaryDto {
  @ApiProperty({ description: 'ID cau hoi da tao' })
  id!: string;

  @ApiProperty({ description: 'Noi dung cau hoi goc' })
  content!: string;

  @ApiProperty({
    description: 'Loai cau hoi',
    enum: QuestionType,
    example: QuestionType.SINGLE_CHOICE,
  })
  type!: QuestionType;

  @ApiProperty({
    description: 'Loai du lieu noi dung cau hoi',
    enum: ContentTypes,
    example: ContentTypes.TEXT,
  })
  contentType!: ContentTypes;

  @ApiProperty({ description: 'So luong dap an da tao' })
  answerCount!: number;
}

export class ImportExamResultDto {
  @ApiProperty({ description: 'So cau hoi da import thanh cong' })
  totalQuestions!: number;

  @ApiProperty({ description: 'So cau tra loi da tao' })
  totalAnswers!: number;

  @ApiProperty({
    description: 'Cac cau hoi da duoc tao',
    type: [ImportExamQuestionSummaryDto],
  })
  questions!: ImportExamQuestionSummaryDto[];
}
