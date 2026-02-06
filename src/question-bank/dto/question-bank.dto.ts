import { ApiProperty } from '@nestjs/swagger';
import { BaseDto } from 'src/common/dto/base.dto';
import { PaginationResponseDto } from 'src/common/dto/pagination.dto';

export class QuestionBankResponseDto extends BaseDto {
  @ApiProperty({
    description: 'Tên ngân hàng câu hỏi',
    example: 'Đề thi học kỳ 1',
  })
  name!: string;


  @ApiProperty({
    description: 'Tổng điểm của kỳ thi',
    example: 100,
  })
  totalMarks!: number;

  @ApiProperty({
    description: 'Ngày diễn ra kỳ thi',
    example: '2026-02-15',
  })
  examDate!: string;

  @ApiProperty({
    description: 'ID lớp học mà ngân hàng câu hỏi thuộc về',
    example: '2233abe3-1961-4af5-a482-542f1227d844',
    required: false,
  })
  classId?: string;

  @ApiProperty({
    description: 'Hình ảnh liên quan đến ngân hàng câu hỏi',
    example: 'https://example.com/image.jpg',
    required: false,
  })
  image?: string;
}

export class QuestionBankListResponseDto extends PaginationResponseDto<QuestionBankResponseDto> {
  @ApiProperty({
    description: 'Danh sách ngân hàng câu hỏi',
    type: [QuestionBankResponseDto],
  })
  declare data: QuestionBankResponseDto[];
}
