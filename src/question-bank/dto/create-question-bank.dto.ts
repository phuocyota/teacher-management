import {
  IsNotEmpty,
  IsInt,
  IsDateString,
  IsUUID,
  Min,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';

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
    description: 'Tong diem',
    example: 100,
    required: false,
  })
  totalScore?: number;

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
}

export class UpdateQuestionBankDto extends PartialType(CreateQuestionBankDto) {}
