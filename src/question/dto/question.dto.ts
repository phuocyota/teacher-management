import { ApiProperty } from '@nestjs/swagger';
import { PaginationResponseDto } from 'src/common/dto/pagination.dto';
import { BaseDto } from 'src/common/dto/base.dto';
import { ContentTypes } from 'src/common/enum/content-type.enum';

export class NextContentDto {
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
    description: 'ID đề thi nếu câu hỏi đang được truy vấn theo question bank',
    example: '2233abe3-1961-4af5-a482-542f1227d844',
    required: false,
  })
  questionBankId?: string;

  @ApiProperty({
    description:
      'Nội dung tiếp theo sau câu hỏi (nếu câu hỏi đó vừa hình vừa chữ xen kẽ nhau)',
    example: '550e8400-e29b-41d4-a716-446655440000',
    required: false,
  })
  nextContent?: string;

  @ApiProperty({
    description: 'Chi tiết của nội dung tiếp theo (nếu có)',
    type: NextContentDto,
    required: false,
  })
  nextContentDetails?: NextContentDto;
}

export class QuestionListResponseDto extends PaginationResponseDto<QuestionResponseDto> {
  @ApiProperty({
    description: 'List of questions',
    type: [QuestionResponseDto],
  })
  declare data: QuestionResponseDto[];
}
