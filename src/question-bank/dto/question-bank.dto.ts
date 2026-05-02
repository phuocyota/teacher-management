import { ApiProperty } from '@nestjs/swagger';
import { BaseDto } from 'src/common/dto/base.dto';
import { PaginationResponseDto } from 'src/common/dto/pagination.dto';
import { ContentTypes } from 'src/common/enum/content-type.enum';
import { QuestionType } from 'src/question/enum/question-type.enum';

export class QuestionBankResponseDto extends BaseDto {
  @ApiProperty({
    description: 'Ma ngan hang cau hoi (code)',
    example: 'QB-1001',
  })
  code!: string;

  @ApiProperty({
    description: 'Ten ngan hang cau hoi',
    example: 'De thi hoc ky 1',
  })
  name!: string;

  @ApiProperty({
    description: 'Tong so cau hoi',
    example: 40,
    required: false,
  })
  totalQuestions?: number;

  @ApiProperty({
    description: 'Thoi gian gioi han (phut)',
    example: 60,
    required: false,
  })
  timeLimit?: number;

  @ApiProperty({
    description: 'Tong diem',
    example: 100,
    required: false,
  })
  totalScore?: number;

  @ApiProperty({
    description: 'So lan lam bai toi da',
    example: 3,
    required: false,
  })
  maxAttempts?: number;

  @ApiProperty({
    description: 'Tong diem cua ky thi',
    example: 100,
  })
  totalMarks!: number;

  @ApiProperty({
    description: 'Ngay dien ra ky thi',
    example: '2026-02-15',
  })
  examDate!: string;

  @ApiProperty({
    description: 'ID lop hoc ma ngan hang cau hoi thuoc ve',
    example: '2233abe3-1961-4af5-a482-542f1227d844',
    required: false,
  })
  classId?: string;

  @ApiProperty({
    description: 'ID bo de thi ma ngan hang cau hoi dang duoc gan vao',
    example: '3233abe3-1961-4af5-a482-542f1227d844',
    required: false,
    nullable: true,
  })
  examSetId?: string | null;

  @ApiProperty({
    description: 'Hinh anh lien quan den ngan hang cau hoi',
    example: 'https://example.com/image.jpg',
    required: false,
  })
  image?: string;
}

export class QuestionBankListResponseDto extends PaginationResponseDto<QuestionBankResponseDto> {
  @ApiProperty({
    description: 'Danh sach ngan hang cau hoi',
    type: [QuestionBankResponseDto],
  })
  declare data: QuestionBankResponseDto[];
}

export class QuestionBankDetailAnswerDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  questionId!: string;

  @ApiProperty()
  content!: string;

  @ApiProperty({ enum: ContentTypes })
  contentType!: ContentTypes;

  @ApiProperty({ required: false, nullable: true })
  isCorrect?: boolean | null;
}

export class QuestionBankDetailQuestionDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  questionBankId!: string;

  @ApiProperty()
  content!: string;

  @ApiProperty({ enum: ContentTypes })
  contentType!: ContentTypes;

  @ApiProperty()
  orderNo!: number;

  @ApiProperty()
  point!: number;

  @ApiProperty({ enum: QuestionType })
  type!: QuestionType;

  @ApiProperty({ type: [QuestionBankDetailAnswerDto] })
  answers!: QuestionBankDetailAnswerDto[];
}

export class QuestionBankDetailResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ type: [QuestionBankDetailQuestionDto] })
  questions!: QuestionBankDetailQuestionDto[];
}
