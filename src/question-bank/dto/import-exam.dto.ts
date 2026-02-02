import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';
import { ContentTypes } from 'src/common/enum/content-type.enum';

export class ImportExamDto {
  @ApiProperty({
    description: 'ID của question bank để import câu hỏi vào',
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
}

export class ParsedQuestion {
  content: string;
  contentType: ContentTypes;
  answers: ParsedAnswer[];
  correctAnswer?: number; // Index của đáp án đúng (0-based)
}

export class ImportExamResultDto {
  @ApiProperty({ description: 'Số câu hỏi đã import thành công' })
  totalQuestions!: number;

  @ApiProperty({ description: 'Số câu trả lời đã tạo' })
  totalAnswers!: number;

  @ApiProperty({ description: 'Các câu hỏi đã được tạo' })
  questions!: Array<{
    id: string;
    content: string;
    contentType: ContentTypes;
    answerCount: number;
  }>;
}
