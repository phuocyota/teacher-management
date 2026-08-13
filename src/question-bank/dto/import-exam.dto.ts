import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';
import { ContentTypes } from 'src/common/enum/content-type.enum';
import { QuestionType } from 'src/question/enum/question-type.enum';
import { AnswerKeyOption } from '../types/question-bank-import.types';

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

  @ApiProperty({
    description: 'Bang dap an parse duoc o cuoi de neu co',
    required: false,
    example: { '1': 'A', '2': 'C' },
  })
  answerKey?: Record<string, AnswerKeyOption>;
}

export class ImportZipAudioFileDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: 'Audio 001' })
  label!: string;

  @ApiProperty({ example: 'Audio 001.mp3' })
  originalName!: string;

  @ApiProperty({ example: '/uploads/question-banks/id/audio.mp3' })
  path!: string;

  @ApiProperty({ example: 'audio/mpeg' })
  mimetype!: string;

  @ApiProperty()
  size!: number;

  @ApiProperty()
  sectionId!: string;
}

export class ImportZipSectionDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: 'NHÓM Câu 21-25' })
  title!: string;

  @ApiProperty({ required: false, nullable: true })
  instruction?: string | null;

  @ApiProperty()
  orderNo!: number;

  @ApiProperty({ required: false, nullable: true, type: Object })
  meta?: Record<string, unknown> | null;
}

export class ImportZipExamResultDto extends ImportExamResultDto {
  @ApiProperty({ type: [ImportZipSectionDto] })
  sections!: ImportZipSectionDto[];

  @ApiProperty({ type: [ImportZipAudioFileDto] })
  audioFiles!: ImportZipAudioFileDto[];

  @ApiProperty({ type: [String] })
  warnings!: string[];
}
