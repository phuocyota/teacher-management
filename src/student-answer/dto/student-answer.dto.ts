import { ApiProperty } from '@nestjs/swagger';
import { BaseDto } from 'src/common/dto/base.dto';
import { PaginationResponseDto } from 'src/common/dto/pagination.dto';

export class StudentAnswerResponseDto extends BaseDto {
  @ApiProperty({
    description: 'ID lần làm bài',
    example: '2233abe3-1961-4af5-a482-542f1227d844',
  })
  attemptId!: string;

  @ApiProperty({
    description: 'ID câu hỏi',
    example: '3233abe3-1961-4af5-a482-542f1227d844',
  })
  questionId!: string;

  @ApiProperty({
    description: 'ID đáp án được chọn',
    example: '4233abe3-1961-4af5-a482-542f1227d844',
    required: false,
  })
  answerId?: string;

  @ApiProperty({
    description: 'Mô tả hoặc ghi chú thêm',
    example: 'Học sinh chọn đáp án dựa trên hình minh họa',
    required: false,
  })
  description?: string;

  @ApiProperty({
    description: 'Nội dung tự luận hoặc điền đáp án',
    example: 'Hà Nội',
    required: false,
  })
  textValue?: string;

  @ApiProperty({
    description: 'Kết quả đúng sai',
    example: true,
    required: false,
  })
  isCorrect?: boolean;

  @ApiProperty({
    description: 'Số điểm đạt được',
    example: 1,
    required: false,
  })
  pointsEarned?: number;

  @ApiProperty({
    description: 'Danh sách ID đáp án được chọn',
    example: [
      '5233abe3-1961-4af5-a482-542f1227d844',
      '6233abe3-1961-4af5-a482-542f1227d844',
    ],
    required: false,
  })
  selectedAnswerIds?: string[];

  @ApiProperty({
    description: 'Thời gian làm câu hỏi tính theo giây',
    example: 45,
    required: false,
  })
  timeSpentSec?: number;
}

export class StudentAnswerListResponseDto extends PaginationResponseDto<StudentAnswerResponseDto> {
  @ApiProperty({
    description: 'Danh sách câu trả lời của học sinh',
    type: [StudentAnswerResponseDto],
  })
  declare data: StudentAnswerResponseDto[];
}
