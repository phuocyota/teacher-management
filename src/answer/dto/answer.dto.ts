import { ApiProperty } from '@nestjs/swagger';
import { ContentTypes } from 'src/common/enum/content-type.enum';
import { PaginationResponseDto } from 'src/common/dto/pagination.dto';
import { BaseDto } from 'src/common/dto/base.dto';

export class NextAnswerContentDto {
  @ApiProperty({
    description: 'ID của nội dung tiếp theo',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id!: string;

  @ApiProperty({
    description: 'Nội dung',
    example: 'anh1.png',
  })
  content!: string;

  @ApiProperty({
    description: 'Loại nội dung',
    enum: ContentTypes,
    example: ContentTypes.IMAGE,
  })
  contentType!: ContentTypes;
}

export class AnswerResponseDto extends BaseDto {
  @ApiProperty({
    description: 'Loại câu trả lời',
    enum: ContentTypes,
    example: ContentTypes.TEXT,
  })
  contentType!: ContentTypes;

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

  @ApiProperty({
    description:
      'ID của nội dung tiếp theo (nếu câu trả lời vừa hình vừa chữ xen kẽ nhau)',
    example: '550e8400-e29b-41d4-a716-446655440000',
    required: false,
  })
  nextContent?: string;

  @ApiProperty({
    description: 'Chi tiết của nội dung tiếp theo (nếu có)',
    type: NextAnswerContentDto,
    required: false,
  })
  nextContentDetails?: NextAnswerContentDto;
}

export class AnswerListResponseDto extends PaginationResponseDto<AnswerResponseDto> {
  @ApiProperty({
    description: 'List of answers',
    type: [AnswerResponseDto],
  })
  declare data: AnswerResponseDto[];
}
