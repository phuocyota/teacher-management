import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsDateString,
  IsDefined,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class QuestionBankExamSetDto {
  @IsUUID()
  @IsDefined()
  @ApiProperty({
    description: 'ID bo de thi can gan de thi vao',
    example: '2233abe3-1961-4af5-a482-542f1227d844',
  })
  examSetId!: string;

  @IsInt()
  @Min(1)
  @IsDefined()
  @ApiProperty({
    description: 'Thu tu cua de thi trong bo de',
    example: 1,
  })
  order!: number;
}

export class CreateQuestionBankDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @ApiProperty({
    description: 'Ma ngan hang cau hoi (code)',
    example: 'QB-1001',
  })
  code!: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    description: 'Ten ngan hang cau hoi',
    example: 'De thi hoc ky 1',
  })
  name!: string;

  @IsInt()
  @IsOptional()
  @Min(0)
  @ApiProperty({
    description: 'Tong so cau hoi',
    example: 40,
    required: false,
  })
  totalQuestions?: number;

  @IsInt()
  @IsOptional()
  @Min(0)
  @ApiProperty({
    description: 'Thoi gian gioi han (phut)',
    example: 60,
    required: false,
  })
  timeLimit?: number;

  @IsInt()
  @IsOptional()
  @Min(0)
  @ApiProperty({
    description: 'So lan lam bai toi da',
    example: 3,
    required: false,
  })
  maxAttempts?: number;

  @IsInt()
  @IsNotEmpty()
  @Min(0)
  @ApiProperty({
    description: 'Tong diem cua ky thi',
    example: 100,
  })
  totalMarks!: number;

  @IsDateString()
  @IsNotEmpty()
  @ApiProperty({
    description: 'Ngay dien ra ky thi (YYYY-MM-DD)',
    example: '2026-02-15',
  })
  examDate!: string;

  @IsUUID()
  @IsNotEmpty()
  @ApiProperty({
    description: 'ID lop hoc ma ngan hang cau hoi thuoc ve',
    example: '2233abe3-1961-4af5-a482-542f1227d844',
  })
  classId!: string;

  @IsString()
  @IsOptional()
  @ApiProperty({
    description: 'Hinh anh lien quan den ngan hang cau hoi (base64 hoac URL)',
    example: 'https://example.com/image.jpg',
    required: false,
  })
  image?: string;

  @IsArray()
  @ArrayUnique((item: QuestionBankExamSetDto) => item.examSetId)
  @ValidateNested({ each: true })
  @Type(() => QuestionBankExamSetDto)
  @IsOptional()
  @ApiProperty({
    description: 'Danh sach bo de thi can lien ket ngay khi tao de thi',
    required: false,
    type: [QuestionBankExamSetDto],
    example: [
      {
        examSetId: '2233abe3-1961-4af5-a482-542f1227d844',
        order: 1,
      },
      {
        examSetId: '3233abe3-1961-4af5-a482-542f1227d844',
        order: 2,
      },
    ],
  })
  examSets?: QuestionBankExamSetDto[];
}

export class UpdateQuestionBankDto extends PartialType(CreateQuestionBankDto) {}
