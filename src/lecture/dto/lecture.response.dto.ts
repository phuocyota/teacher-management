import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LectureResponse {
  //groupId
  @ApiPropertyOptional({
    type: 'string',
    format: 'uuid',
  })
  groupId?: string;

  //courseId
  @ApiPropertyOptional({
    type: 'string',
    format: 'uuid',
  })
  courseId?: string;

  //classId
  @ApiPropertyOptional({
    type: 'string',
    format: 'uuid',
  })
  classId?: string;
  //code
  @ApiPropertyOptional({
    type: 'string',
    example: 'CS101',
    description: 'Mã của bài giảng',
  })
  code?: string;

  //title
  @ApiProperty({
    type: 'string',
    example: 'Giới thiệu về Khoa học Máy tính',
    description: 'Tiêu đề của bài giảng',
  })
  title: string;

  //note
  @ApiPropertyOptional({
    type: 'string',
    example: 'Đây là bài giảng đầu tiên trong khóa học.',
    description: 'Ghi chú thêm cho bài giảng',
  })
  note?: string;

  //orderColumn
  @ApiProperty({
    type: 'number',
    example: 1,
    description: 'Thứ tự sắp xếp của bài giảng',
    default: 0,
  })
  orderColumn: number;

  //avatar
  @ApiPropertyOptional({
    type: 'string',
    description: 'Ảnh đại diện bài giảng (URL hoặc base64)',
  })
  avatar?: string;
}

export class LectureResponseDto {
  @ApiProperty({ description: 'ID của bài giảng' })
  id: string;

  @ApiPropertyOptional({
    type: 'string',
    example: 'CS101',
    description: 'Mã của bài giảng',
  })
  code?: string;

  @ApiProperty({
    type: 'string',
    example: 'Giới thiệu về Khoa học Máy tính',
    description: 'Tiêu đề của bài giảng',
  })
  title: string;

  @ApiPropertyOptional({
    type: 'string',
    example: 'Đây là bài giảng đầu tiên trong khóa học.',
    description: 'Ghi chú thêm cho bài giảng',
  })
  note?: string;

  @ApiProperty({
    type: 'number',
    example: 1,
    description: 'Thứ tự sắp xếp của bài giảng',
    default: 0,
  })
  orderColumn: number;

  @ApiPropertyOptional({
    type: 'string',
    description: 'Ảnh đại diện bài giảng (URL hoặc base64)',
  })
  avatar?: string;

  @ApiProperty({ description: 'Người tạo' })
  createdBy?: string;

  @ApiProperty({ description: 'Thời gian tạo' })
  createdAt?: Date;

  @ApiProperty({ description: 'Thời gian cập nhật' })
  updatedAt?: Date;
}
