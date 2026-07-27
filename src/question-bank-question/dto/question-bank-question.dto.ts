import { ApiProperty } from '@nestjs/swagger';
import { BaseDto } from 'src/common/dto/base.dto';
import { PaginationResponseDto } from 'src/common/dto/pagination.dto';

export class QuestionBankQuestionResponseDto extends BaseDto {
  @ApiProperty({
    description: 'ID ngân hàng câu hỏi',
    example: '2233abe3-1961-4af5-a482-542f1227d844',
  })
  questionBankId!: string;

  @ApiProperty({
    description: 'ID câu hỏi',
    example: '1233abe3-1961-4af5-a482-542f1227d844',
  })
  questionId!: string;

  @ApiProperty({
    description: 'Thứ tự câu hỏi trong ngân hàng câu hỏi',
    example: 1,
  })
  orderNo!: number;

  @ApiProperty({
    description: 'Số điểm của câu hỏi',
    example: 2.5,
  })
  points!: number;

  @ApiProperty({
    description: 'ID phần đề thi chứa câu hỏi',
    required: false,
    nullable: true,
  })
  sectionId?: string | null;
}

export class QuestionBankQuestionListResponseDto extends PaginationResponseDto<QuestionBankQuestionResponseDto> {
  @ApiProperty({
    description: 'Danh sách liên kết ngân hàng câu hỏi và câu hỏi',
    type: [QuestionBankQuestionResponseDto],
  })
  declare data: QuestionBankQuestionResponseDto[];
}
