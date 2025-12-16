import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  IsDateString,
  IsArray,
} from 'class-validator';
import { FileVisibility, FileAccessType } from '../enum/file-visibility.enum';

export class UploadFileResponseDto {
  @ApiProperty({
    description: 'ID của file',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'Tên file gốc',
    example: 'document.pdf',
  })
  originalName: string;

  @ApiProperty({
    description: 'Tên file đã lưu trên server',
    example: '1702732800000-document.pdf',
  })
  filename: string;

  @ApiProperty({
    description: 'Đường dẫn file trên server',
    example: 'uploads/1702732800000-document.pdf',
  })
  path: string;

  @ApiProperty({
    description: 'MIME type của file',
    example: 'application/pdf',
  })
  mimetype: string;

  @ApiProperty({
    description: 'Kích thước file (bytes)',
    example: 102400,
  })
  size: number;

  @ApiProperty({
    description: 'Mức độ hiển thị của file',
    enum: FileVisibility,
    example: FileVisibility.PRIVATE,
  })
  visibility: FileVisibility;
}

export class UploadMultipleFilesResponseDto {
  @ApiProperty({
    description: 'Danh sách các file đã upload',
    type: [UploadFileResponseDto],
  })
  files: UploadFileResponseDto[];

  @ApiProperty({
    description: 'Tổng số file đã upload',
    example: 3,
  })
  totalFiles: number;
}

export class UploadFileDto {
  @ApiPropertyOptional({
    description: 'Mức độ hiển thị của file',
    enum: FileVisibility,
    default: FileVisibility.PRIVATE,
  })
  @IsEnum(FileVisibility)
  @IsOptional()
  visibility?: FileVisibility;

  @ApiPropertyOptional({
    description: 'Mô tả file',
    example: 'Tài liệu hướng dẫn',
  })
  @IsString()
  @IsOptional()
  description?: string;
}

export class GrantFileAccessDto {
  @ApiProperty({
    description: 'ID của user được cấp quyền',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  userId: string;

  @ApiProperty({
    description: 'Loại quyền truy cập',
    enum: FileAccessType,
    example: FileAccessType.VIEW,
  })
  @IsEnum(FileAccessType)
  accessType: FileAccessType;

  @ApiPropertyOptional({
    description: 'Thời gian hết hạn quyền truy cập',
    example: '2025-12-31T23:59:59Z',
  })
  @IsDateString()
  @IsOptional()
  expiresAt?: string;
}

export class GrantFileAccessToManyDto {
  @ApiProperty({
    description: 'Danh sách ID của users được cấp quyền',
    example: ['user-id-1', 'user-id-2'],
    type: [String],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  userIds: string[];

  @ApiProperty({
    description: 'Loại quyền truy cập',
    enum: FileAccessType,
    example: FileAccessType.VIEW,
  })
  @IsEnum(FileAccessType)
  accessType: FileAccessType;

  @ApiPropertyOptional({
    description: 'Thời gian hết hạn quyền truy cập',
    example: '2025-12-31T23:59:59Z',
  })
  @IsDateString()
  @IsOptional()
  expiresAt?: string;
}

export class UpdateFileVisibilityDto {
  @ApiProperty({
    description: 'Mức độ hiển thị mới của file',
    enum: FileVisibility,
    example: FileVisibility.RESTRICTED,
  })
  @IsEnum(FileVisibility)
  visibility: FileVisibility;
}

export class FileAccessResponseDto {
  @ApiProperty({ description: 'ID của quyền truy cập' })
  id: string;

  @ApiProperty({ description: 'ID của file' })
  fileId: string;

  @ApiProperty({ description: 'ID của user' })
  userId: string;

  @ApiProperty({
    description: 'Loại quyền truy cập',
    enum: FileAccessType,
  })
  accessType: FileAccessType;

  @ApiPropertyOptional({ description: 'Thời gian hết hạn' })
  expiresAt?: Date;
}
