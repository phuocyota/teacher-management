import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  IsDateString,
  IsArray,
} from 'class-validator';
import { FileAccessType, FileType } from '../enum/file-visibility.enum';
import { FileEntity } from '../entity/file.entity';
import { FileAccessEntity } from '../entity/file-access.entity';

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
    description: 'Loại file',
    enum: FileType,
    example: FileType.NORMAL,
  })
  fileType: FileType;

  @ApiPropertyOptional({
    description: 'Mô tả file',
  })
  description?: string;

  @ApiProperty({
    description: 'ID người upload',
  })
  uploadedBy: string;

  @ApiProperty({
    description: 'Thời gian tạo',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Thời gian cập nhật',
  })
  updatedAt: Date;

  static fromEntity(entity: FileEntity): UploadFileResponseDto {
    const dto = new UploadFileResponseDto();
    dto.id = entity.id;
    dto.originalName = entity.originalName;
    dto.filename = entity.filename;
    dto.path = entity.path;
    dto.mimetype = entity.mimetype;
    dto.size = entity.size;
    dto.fileType = entity.fileType;
    dto.description = entity.description;
    dto.uploadedBy = entity.uploadedBy;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }
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
    description: 'Loại file',
    enum: FileType,
    default: FileType.NORMAL,
  })
  @IsEnum(FileType)
  @IsOptional()
  fileType?: FileType;

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

  @ApiProperty({ description: 'Người cấp quyền' })
  grantedBy: string;

  @ApiProperty({ description: 'Thời gian tạo' })
  createdAt: Date;

  static fromEntity(entity: FileAccessEntity): FileAccessResponseDto {
    const dto = new FileAccessResponseDto();
    dto.id = entity.id;
    dto.fileId = entity.fileId;
    dto.userId = entity.userId;
    dto.accessType = entity.accessType;
    dto.expiresAt = entity.expiresAt;
    dto.grantedBy = entity.grantedBy;
    dto.createdAt = entity.createdAt;
    return dto;
  }
}
