import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  ValidateNested,
  IsEnum,
  IsUUID,
  MinLength,
  MaxLength,
  Min,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationRequestDto } from 'src/common/dto/pagination.dto';

export class LectureResourceDto {
  @ApiProperty({
    type: 'string',
    enum: ['PDF', 'VIDEO', 'LESSON'],
    example: 'VIDEO',
    description: 'Loại tài nguyên của bài giảng',
    default: 'PDF',
  })
  @IsEnum(['PDF', 'VIDEO', 'LESSON'], {
    message: 'type phải là một trong các giá trị: PDF, VIDEO, LESSON',
  })
  @IsString()
  type: string;

  @ApiProperty({
    type: 'string',
    enum: ['ONLINE', 'OFFLINE'],
    example: 'ONLINE',
    description: 'Nguồn của tài nguyên (ONLINE: URL, OFFLINE: file path)',
    default: 'ONLINE',
  })
  @IsEnum(['ONLINE', 'OFFLINE'], {
    message: 'source phải là ONLINE hoặc OFFLINE',
  })
  @IsString()
  source: string;

  @ApiProperty({
    type: 'string',
    example: 'https://example.com/video.mp4',
    description: 'URL hoặc đường dẫn tới tài nguyên (tối thiểu 10 ký tự)',
    minLength: 10,
  })
  @IsString()
  @MinLength(10, {
    message: 'URL phải có ít nhất 10 ký tự',
  })
  url: string;
}

export class CreateLectureDto {
  @ApiProperty({
    type: 'string',
    example: 'CS101',
    description:
      'Mã định danh duy nhất cho bài giảng (bắt buộc, tối đa 50 ký tự)',
    maxLength: 50,
  })
  @IsString({ message: 'code phải là một chuỗi ký tự' })
  @MinLength(1, { message: 'code không được để trống' })
  @MaxLength(50, { message: 'code không được vượt quá 50 ký tự' })
  code: string;

  //userId
  @ApiPropertyOptional({
    type: 'string',
    format: 'uuid',
    example: 'u1u2u3u4-u5u6-u7u8-u9u0-u1u2u3u4u5u6',
    description: 'UUID của người dùng (nếu cần xác định người tạo)',
  })
  @IsOptional()
  @IsUUID('4', { message: 'userId phải là một UUID hợp lệ' })
  userId?: string;

  @ApiProperty({
    type: 'string',
    example: 'Giới thiệu về Khoa học Máy tính',
    description: 'Tiêu đề bài giảng (bắt buộc, từ 1-255 ký tự)',
    minLength: 1,
    maxLength: 255,
  })
  @IsString({ message: 'title phải là một chuỗi ký tự' })
  @MinLength(1, { message: 'title không được để trống' })
  @MaxLength(255, { message: 'title không được vượt quá 255 ký tự' })
  title: string;

  @ApiPropertyOptional({
    type: 'string',
    example: 'Đây là bài giảng đầu tiên trong khóa học.',
    description: 'Ghi chú thêm cho bài giảng (tối đa 1000 ký tự)',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString({ message: 'note phải là một chuỗi ký tự' })
  @MaxLength(1000, { message: 'note không được vượt quá 1000 ký tự' })
  note?: string;

  @ApiPropertyOptional({
    type: 'number',
    example: 0,
    description: 'Thứ tự sắp xếp bài giảng (phải >= 0)',
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({}, { message: 'orderColumn phải là một số' })
  @Min(0, { message: 'orderColumn phải lớn hơn hoặc bằng 0' })
  orderColumn?: number = 0;

  @ApiPropertyOptional({
    type: 'string',
    example: 'https://example.com/avatar.jpg',
    description: 'Ảnh đại diện bài giảng (URL hoặc base64, tối đa 2000 ký tự)',
    maxLength: 2000,
  })
  @IsOptional()
  @IsString({ message: 'avatar phải là một chuỗi ký tự' })
  @MaxLength(2000, { message: 'avatar không được vượt quá 2000 ký tự' })
  avatar?: string;

  @ApiProperty({
    type: 'string',
    format: 'uuid',
    example: 'c1c2c3c4-c5c6-c7c8-c9c0-c1c2c3c4c5c6',
    description: 'UUID của khóa học (bắt buộc)',
  })
  @IsNotEmpty({ message: 'courseId không được để trống' })
  @IsUUID('4', { message: 'courseId phải là một UUID hợp lệ' })
  courseId: string;

  @ApiPropertyOptional({
    type: 'string',
    format: 'uuid',
    example: 'g1g2g3g4-g5g6-g7g8-g9g0-g1g2g3g4g5g6',
    description: 'UUID của nhóm (tùy chọn)',
  })
  @IsOptional()
  @IsUUID('4', { message: 'groupId phải là một UUID hợp lệ' })
  groupId?: string;

  @ApiPropertyOptional({
    type: 'array',
    items: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['PDF', 'VIDEO', 'LESSON'] },
        source: { type: 'string', enum: ['ONLINE', 'OFFLINE'] },
        url: { type: 'string' },
      },
    },
    description: 'Danh sách tài nguyên của bài giảng (được tạo cùng bài giảng)',
    example: [
      {
        type: 'VIDEO',
        source: 'ONLINE',
        url: 'https://example.com/video.mp4',
      },
      {
        type: 'PDF',
        source: 'OFFLINE',
        url: '/files/lecture-slides.pdf',
      },
    ],
  })
  @IsOptional()
  @IsArray({ message: 'resources phải là một mảng' })
  @ValidateNested({ each: true, message: 'Mỗi resource phải đúng định dạng' })
  @Type(() => LectureResourceDto)
  resources?: LectureResourceDto[];
}

export class UpdateLectureDto {
  @ApiPropertyOptional({
    type: 'string',
    example: 'CS101-Updated',
    description: 'Mã định danh bài giảng (unique, từ 1-50 ký tự)',
    minLength: 1,
    maxLength: 50,
  })
  @IsOptional()
  @IsString({ message: 'code phải là một chuỗi ký tự' })
  @MinLength(1, { message: 'code không được để trống' })
  @MaxLength(50, { message: 'code không được vượt quá 50 ký tự' })
  code?: string;

  @ApiPropertyOptional({
    type: 'string',
    example: 'Giới thiệu về Khoa học Máy tính (Nâng cao)',
    description: 'Tiêu đề bài giảng (từ 1-255 ký tự)',
    minLength: 1,
    maxLength: 255,
  })
  @IsOptional()
  @IsString({ message: 'title phải là một chuỗi ký tự' })
  @MinLength(1, { message: 'title không được để trống' })
  @MaxLength(255, { message: 'title không được vượt quá 255 ký tự' })
  title?: string;

  @ApiPropertyOptional({
    type: 'string',
    example: 'Cập nhật nội dung bài giảng lần 2.',
    description: 'Ghi chú thêm cho bài giảng (tối đa 1000 ký tự)',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString({ message: 'note phải là một chuỗi ký tự' })
  @MaxLength(1000, { message: 'note không được vượt quá 1000 ký tự' })
  note?: string;

  @ApiPropertyOptional({
    type: 'number',
    example: 1,
    description: 'Thứ tự sắp xếp bài giảng (phải >= 0)',
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({}, { message: 'orderColumn phải là một số' })
  @Min(0, { message: 'orderColumn phải lớn hơn hoặc bằng 0' })
  orderColumn?: number;

  @ApiPropertyOptional({
    type: 'string',
    example: 'https://example.com/avatar-new.jpg',
    description: 'Ảnh đại diện bài giảng (URL hoặc base64, tối đa 2000 ký tự)',
    maxLength: 2000,
  })
  @IsOptional()
  @IsString({ message: 'avatar phải là một chuỗi ký tự' })
  @MaxLength(2000, { message: 'avatar không được vượt quá 2000 ký tự' })
  avatar?: string;

  //userId
  @ApiPropertyOptional({
    type: 'string',
    format: 'uuid',
    example: 'u1u2u3u4-u5u6-u7u8-u9u0-u1u2u3u4u5u6',
    description: 'UUID của người dùng (nếu cần xác định người tạo)',
  })
  @IsOptional()
  @IsUUID('4', { message: 'userId phải là một UUID hợp lệ' })
  userId?: string;

  @ApiPropertyOptional({
    type: 'string',
    format: 'uuid',
    example: 'g1g2g3g4-g5g6-g7g8-g9g0-g1g2g3g4g5g6',
    description: 'UUID của nhóm (nếu cập nhật phân bổ vào nhóm)',
  })
  @IsOptional()
  @IsUUID('4', { message: 'groupId phải là một UUID hợp lệ' })
  groupId?: string;

  @ApiPropertyOptional({
    type: 'array',
    items: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['PDF', 'VIDEO', 'LESSON'] },
        source: { type: 'string', enum: ['ONLINE', 'OFFLINE'] },
        url: { type: 'string' },
      },
    },
    description:
      'Danh sách tài nguyên của bài giảng (sẽ thay thế toàn bộ resources hiện tại)',
    example: [
      {
        type: 'VIDEO',
        source: 'ONLINE',
        url: 'https://example.com/video-updated.mp4',
      },
      {
        type: 'PDF',
        source: 'OFFLINE',
        url: '/files/lecture-slides-v2.pdf',
      },
    ],
  })
  @IsOptional()
  @IsArray({ message: 'resources phải là một mảng' })
  @ValidateNested({ each: true, message: 'Mỗi resource phải đúng định dạng' })
  @Type(() => LectureResourceDto)
  resources?: LectureResourceDto[];
}

// DTO dùng cho get danh sách bài giảng với phân trang và lọc
export class GetAllLectureDto extends PaginationRequestDto {
  @ApiPropertyOptional({
    type: 'string',
    format: 'uuid',
    description: 'Lọc theo ID khóa học',
  })
  @IsOptional()
  @IsUUID('4', { message: 'courseId phải là một UUID hợp lệ' })
  courseId?: string;

  @ApiPropertyOptional({
    type: 'string',
    format: 'uuid',
    description: 'Lọc theo ID nhóm',
  })
  @IsOptional()
  @IsUUID('4', { message: 'groupId phải là một UUID hợp lệ' })
  groupId?: string;
}
