import { ApiProperty } from '@nestjs/swagger';
import { BaseDto } from 'src/common/dto/base.dto';
import { PaginationResponseDto } from 'src/common/dto/pagination.dto';

export class ExamSetQuestionBankQuestionBankDto {
  @ApiProperty({
    description: 'ID ngan hang cau hoi',
    example: 'a6fd0f8e-b2bf-4fe8-8be1-1062f27822da',
  })
  id!: string;

  @ApiProperty({
    description: 'Ma de thi',
    example: 'K1_CDS_HK1_2025_2026',
  })
  code!: string;

  @ApiProperty({
    description: 'Ten de thi',
    example: 'De thi hoc ky 1 2025-2026',
  })
  name!: string;

  @ApiProperty({
    description: 'Tong diem bai thi',
    example: 100,
  })
  totalMarks!: number;

  @ApiProperty({
    description: 'Ngay thi',
    example: '2026-02-15',
  })
  examDate!: string;

  @ApiProperty({
    description: 'ID lop hoc cua de thi',
    example: '2233abe3-1961-4af5-a482-542f1227d844',
  })
  classId!: string;
}

export class ExamSetQuestionBankResponseDto extends BaseDto {
  @ApiProperty({
    description: 'ID bo de thi',
    example: '2233abe3-1961-4af5-a482-542f1227d844',
  })
  examSetId!: string;

  @ApiProperty({
    description: 'ID ngan hang cau hoi',
    example: 'a6fd0f8e-b2bf-4fe8-8be1-1062f27822da',
  })
  questionBankId!: string;

  @ApiProperty({
    description: 'Thu tu sap xep',
    example: 1,
  })
  order!: number;

  @ApiProperty({
    description: 'Thong tin de thi',
    type: ExamSetQuestionBankQuestionBankDto,
    required: false,
  })
  questionBank?: ExamSetQuestionBankQuestionBankDto;

  @ApiProperty({
    description: 'Ma de thi',
    example: 'K1_CDS_HK1_2025_2026',
    required: false,
  })
  code?: string;

  @ApiProperty({
    description: 'Ten de thi',
    example: 'De thi hoc ky 1 2025-2026',
    required: false,
  })
  name?: string;

  @ApiProperty({
    description: 'Tong diem bai thi',
    example: 100,
    required: false,
  })
  totalMarks?: number;

  @ApiProperty({
    description: 'Ngay thi',
    example: '2026-02-15',
    required: false,
  })
  examDate?: string;

  @ApiProperty({
    description: 'ID lop hoc cua de thi',
    example: '2233abe3-1961-4af5-a482-542f1227d844',
    required: false,
  })
  classId?: string;
}

export class ExamSetQuestionBankListResponseDto extends PaginationResponseDto<ExamSetQuestionBankResponseDto> {
  @ApiProperty({
    description: 'Danh sach lien ket bo de thi - ngan hang cau hoi',
    type: [ExamSetQuestionBankResponseDto],
  })
  declare data: ExamSetQuestionBankResponseDto[];
}
