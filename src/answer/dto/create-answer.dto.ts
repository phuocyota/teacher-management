import {
  IsNotEmpty,
  IsString,
  IsEnum,
  IsUUID,
  IsOptional,
  IsBoolean,
  IsInt,
  Min,
} from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';
import { ContentTypes } from 'src/common/enum/content-type.enum';

export class CreateAnswerDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @ApiProperty({
    description: 'Thu tu cua dap an trong cau hoi',
    example: 1,
    required: false,
  })
  orderNo?: number;

  @IsOptional()
  @IsBoolean()
  @ApiProperty({
    description: 'Danh dau dap an dung',
    example: true,
    required: false,
  })
  isCorrect?: boolean;

  @IsEnum(ContentTypes)
  @IsNotEmpty()
  @ApiProperty({
    description: 'Loai cau tra loi',
    enum: ContentTypes,
    example: ContentTypes.TEXT,
  })
  contentType!: ContentTypes;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    description: 'Noi dung cau tra loi',
    example: 'Paris',
  })
  content!: string;

  @IsUUID()
  @IsNotEmpty()
  @ApiProperty({
    description: 'ID cau hoi ma cau tra loi thuoc ve',
    example: '2233abe3-1961-4af5-a482-542f1227d844',
  })
  questionId!: string;

  @IsUUID()
  @IsOptional()
  @ApiProperty({
    description: 'ID cua noi dung tiep theo neu co',
    example: '550e8400-e29b-41d4-a716-446655440000',
    required: false,
  })
  nextContent?: string;
}

export class UpdateAnswerDto extends PartialType(CreateAnswerDto) {}
