import { ApiProperty } from '@nestjs/swagger';
import { PaginationResponseDto } from 'src/common/dto/pagination.dto';
import { BaseDto } from 'src/common/dto/base.dto';
import { ContentTypes } from 'src/common/enum/content-type.enum';
import { QuestionType } from '../enum/question-type.enum';

export class NextContentDto {
  @ApiProperty({
    description: 'Loai cau hoi',
    enum: QuestionType,
    example: QuestionType.SINGLE_CHOICE,
  })
  type!: QuestionType;

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

export class QuestionResponseDto extends BaseDto {
  @ApiProperty({
    description: 'Loai cau hoi',
    enum: QuestionType,
    example: QuestionType.SINGLE_CHOICE,
  })
  type!: QuestionType;

  @ApiProperty({
    description: 'Loai du lieu cua cau hoi',
    enum: ContentTypes,
    example: ContentTypes.TEXT,
  })
  contentType!: ContentTypes;

  @ApiProperty({
    description: 'Noi dung cau hoi',
    example: 'What is the capital of France?',
  })
  content!: string;

  @ApiProperty({
    description: 'Danh dau day co phai question goc cua chain hay khong',
    example: true,
  })
  isRoot!: boolean;

  @ApiProperty({
    description: 'ID de thi neu cau hoi dang duoc truy van theo question bank',
    example: '2233abe3-1961-4af5-a482-542f1227d844',
    required: false,
  })
  questionBankId?: string;

  @ApiProperty({
    description: 'ID cua noi dung tiep theo neu co',
    example: '550e8400-e29b-41d4-a716-446655440000',
    required: false,
  })
  nextContent?: string;

  @ApiProperty({
    description: 'Chi tiet cua noi dung tiep theo neu co',
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
