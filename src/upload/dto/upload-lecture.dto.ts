import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsUUID,
  IsArray,
  MaxLength,
} from 'class-validator';

/**
 * DTO cho upload file dưới dạng bài giảng
 */
export class UploadLectureFileDto {
  @ApiProperty({
    description: 'Tiêu đề bài giảng',
    example: 'Toán học cơ bản',
  })
  @IsString()
  @MaxLength(255)
  lectureTitle: string;

  @ApiPropertyOptional({
    description: 'Mô tả bài giảng',
    example: 'Bài giảng về các khái niệm cơ bản của toán học',
  })
  @IsString()
  @IsOptional()
  lectureDescription?: string;

  @ApiPropertyOptional({
    description: 'Danh sách ID giáo viên được xem bài giảng này',
    example: [
      'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      'a1b2c3d4-e5f6-7890-abcd-ef1234567891',
    ],
    type: [String],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  teacherIds?: string[];

  @ApiPropertyOptional({
    description: 'Mô tả file',
    example: 'Tài liệu PDF',
  })
  @IsString()
  @IsOptional()
  fileDescription?: string;
}

/**
 * DTO response cho upload lecture
 */
export class UploadLectureResponseDto {
  @ApiProperty({ description: 'ID của file' })
  fileId: string;

  @ApiProperty({ description: 'Tên file' })
  filename: string;

  @ApiProperty({ description: 'Tên file gốc' })
  originalName: string;

  @ApiProperty({ description: 'Kích thước file (bytes)' })
  size: number;

  @ApiProperty({ description: 'ID của bài giảng' })
  lectureId: string;

  @ApiProperty({ description: 'Tiêu đề bài giảng' })
  lectureTitle: string;

  @ApiPropertyOptional({ description: 'Số lượng giáo viên được cấp quyền' })
  teachersGranted?: number;

  @ApiProperty({ description: 'Ngày tạo' })
  createdAt: Date;
}
