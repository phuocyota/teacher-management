import { ApiProperty } from '@nestjs/swagger';
import { ContentTypes } from 'src/common/enum/content-type.enum';
import { PaginationResponseDto } from 'src/common/dto/pagination.dto';
import { BaseDto } from 'src/common/dto/base.dto';

export class NextAnswerContentDto {
  @ApiProperty({
    description: 'ID cua noi dung tiep theo',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id!: string;

  @ApiProperty({
    description: 'Noi dung',
    example: 'anh1.png',
  })
  content!: string;

  @ApiProperty({
    description: 'Loai noi dung',
    enum: ContentTypes,
    example: ContentTypes.IMAGE,
  })
  contentType!: ContentTypes;
}

export class AnswerResponseDto extends BaseDto {
  @ApiProperty({
    description: 'Thu tu cua dap an trong cau hoi',
    example: 1,
    required: false,
  })
  orderNo?: number;

  @ApiProperty({
    description: 'Danh dau dap an dung',
    example: true,
    required: false,
  })
  isCorrect?: boolean;

  @ApiProperty({
    description: 'Loai cau tra loi',
    enum: ContentTypes,
    example: ContentTypes.TEXT,
  })
  contentType!: ContentTypes;

  @ApiProperty({
    description: 'Noi dung cau tra loi',
    example: 'Paris',
  })
  content!: string;

  @ApiProperty({
    description: 'ID cau hoi ma cau tra loi thuoc ve',
    example: '2233abe3-1961-4af5-a482-542f1227d844',
  })
  questionId!: string;

  @ApiProperty({
    description: 'ID cua noi dung tiep theo neu co',
    example: '550e8400-e29b-41d4-a716-446655440000',
    required: false,
  })
  nextContent?: string;

  @ApiProperty({
    description: 'Chi tiet cua noi dung tiep theo neu co',
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
