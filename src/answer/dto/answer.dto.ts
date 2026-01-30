import { ApiProperty } from '@nestjs/swagger';
import { ContentTypes } from 'src/common/enum/content-type.enum';
import { PaginationResponseDto } from 'src/common/dto/pagination.dto';
import { BaseDto } from 'src/common/dto/base.dto';

export class AnswerResponseDto extends BaseDto {
  @ApiProperty({
    description: 'Loại câu trả lời',
    enum: ContentTypes,
    example: ContentTypes.TEXT,
  })
  answerType!: ContentTypes;

  @ApiProperty({
    description: 'Nội dung câu trả lời',
    example: 'Paris',
  })
  content!: string;

  @ApiProperty({
    description: 'ID câu hỏi mà câu trả lời thuộc về',
    example: '2233abe3-1961-4af5-a482-542f1227d844',
  })
  questionId!: string;
}

export class AnswerListResponseDto extends PaginationResponseDto<AnswerResponseDto> {
  @ApiProperty({
    description: 'List of answers',
    type: [AnswerResponseDto],
  })
  declare data: AnswerResponseDto[];
}
