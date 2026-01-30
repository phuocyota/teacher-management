import { IsNotEmpty, IsString, IsEnum, IsUUID } from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';
import { ContentTypes } from 'src/common/enum/content-type.enum';

export class CreateAnswerDto {
  @IsEnum(ContentTypes)
  @IsNotEmpty()
  @ApiProperty({
    description: 'Loại câu trả lời',
    enum: ContentTypes,
    example: ContentTypes.TEXT,
  })
  contentType!: ContentTypes;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    description: 'Nội dung câu trả lời',
    example: 'Paris',
  })
  content!: string;

  @IsUUID()
  @IsNotEmpty()
  @ApiProperty({
    description: 'ID câu hỏi mà câu trả lời thuộc về',
    example: '2233abe3-1961-4af5-a482-542f1227d844',
  })
  questionId!: string;
}

export class UpdateAnswerDto extends PartialType(CreateAnswerDto) {}
