import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { BaseDto } from 'src/common/dto/base.dto';

export class CreateQuestionBankSectionDto {
  @IsUUID()
  @IsNotEmpty()
  @ApiProperty()
  questionBankId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @ApiProperty({ example: 'PART I: VOCABULARY' })
  title!: string;

  @IsString()
  @IsOptional()
  @ApiProperty({ required: false, nullable: true })
  instruction?: string | null;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @ApiProperty({ example: 1 })
  orderNo!: number;

  @IsObject()
  @IsOptional()
  @ApiProperty({ required: false, nullable: true, type: Object })
  meta?: Record<string, unknown> | null;
}

export class UpdateQuestionBankSectionDto extends PartialType(
  CreateQuestionBankSectionDto,
) {}

export class QuestionBankSectionResponseDto extends BaseDto {
  @ApiProperty()
  questionBankId!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty({ required: false, nullable: true })
  instruction?: string | null;

  @ApiProperty()
  orderNo!: number;

  @ApiProperty({ required: false, nullable: true, type: Object })
  meta?: Record<string, unknown> | null;
}
