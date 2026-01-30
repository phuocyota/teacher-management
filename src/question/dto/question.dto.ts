import { ApiProperty } from '@nestjs/swagger';
import { PaginationResponseDto } from 'src/common/dto/pagination.dto';
import { BaseDto } from 'src/common/dto/base.dto';
import { ContentTypes } from 'src/common/enum/content-type.enum';

export class QuestionResponseDto extends BaseDto {
  @ApiProperty({
    description: 'Loại dữ liệu của câu hỏi',
    enum: ContentTypes,
    example: ContentTypes.TEXT,
  })
  contentType!: ContentTypes;

  @ApiProperty({
    description: 'Nội dung của câu hỏi',
    example: 'What is the capital of France?',
  })
  content!: string;

  @ApiProperty({
    description: 'ID Ngân hàng câu hỏi mà câu hỏi thuộc về',
    example: '2233abe3-1961-4af5-a482-542f1227d844',
  })
  questionBankId!: string;
}

export class QuestionListResponseDto extends PaginationResponseDto<QuestionResponseDto> {
  @ApiProperty({
    description: 'List of questions',
    type: [QuestionResponseDto],
  })
  declare data: QuestionResponseDto[];
}
