import { ApiProperty, PartialType } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { ExamSetStatus } from '../enum/exam-set-status.enum';

export class CreateExamSetDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    description: 'Ten bo de thi',
    example: 'Bo de thi hoc ky 1',
  })
  name!: string;

  @IsString()
  @IsOptional()
  @ApiProperty({
    description: 'Mo ta bo de thi',
    example: 'Bo de danh cho lop 10A1 mon Toan',
    required: false,
  })
  description?: string;

  @IsString()
  @IsOptional()
  @ApiProperty({
    description: 'Hinh anh bo de thi (base64 hoac URL)',
    example: 'https://example.com/exam-set-image.jpg',
    required: false,
  })
  image?: string;

  @IsUUID()
  @IsOptional()
  @ApiProperty({
    description: 'ID lop hoc dau tien, giu lai de tuong thich API cu',
    example: '2233abe3-1961-4af5-a482-542f1227d844',
    required: false,
  })
  classId?: string;

  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  @IsOptional()
  @ApiProperty({
    description: 'Danh sach ID lop hoc thuoc bo de thi',
    example: [
      '2233abe3-1961-4af5-a482-542f1227d844',
      '3233abe3-1961-4af5-a482-542f1227d844',
    ],
    required: false,
    type: [String],
  })
  classIds?: string[];

  @IsEnum(ExamSetStatus)
  @IsOptional()
  @ApiProperty({
    description: 'Trang thai bo de',
    example: ExamSetStatus.DRAFT,
    enum: ExamSetStatus,
    required: false,
  })
  status?: ExamSetStatus;
}

export class UpdateExamSetDto extends PartialType(CreateExamSetDto) {}
