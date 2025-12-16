import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsEnum, IsOptional, IsDateString } from 'class-validator';
import { PermissionType } from '../enum/permission-type.enum';

export class GrantLecturePermissionDto {
  @ApiProperty({
    description: 'ID của bài giảng',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsUUID()
  lectureId: string;

  @ApiProperty({
    description: 'ID của giáo viên',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567891',
  })
  @IsUUID()
  teacherId: string;

  @ApiProperty({
    description: 'Loại quyền',
    enum: PermissionType,
    example: PermissionType.VIEW,
  })
  @IsEnum(PermissionType)
  permissionType: PermissionType;

  @ApiPropertyOptional({
    description: 'Ngày hết hạn của quyền (ISO 8601)',
    example: '2025-12-31T23:59:59Z',
  })
  @IsDateString()
  @IsOptional()
  expiresAt?: string;
}

export class GrantMultipleLecturePermissionsDto {
  @ApiProperty({
    description: 'ID của bài giảng',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsUUID()
  lectureId: string;

  @ApiProperty({
    description: 'Danh sách ID giáo viên',
    example: [
      'a1b2c3d4-e5f6-7890-abcd-ef1234567891',
      'a1b2c3d4-e5f6-7890-abcd-ef1234567892',
    ],
    type: [String],
  })
  @IsUUID('4', { each: true })
  teacherIds: string[];

  @ApiProperty({
    description: 'Loại quyền',
    enum: PermissionType,
    example: PermissionType.VIEW,
  })
  @IsEnum(PermissionType)
  permissionType: PermissionType;

  @ApiPropertyOptional({
    description: 'Ngày hết hạn của quyền (ISO 8601)',
    example: '2025-12-31T23:59:59Z',
  })
  @IsDateString()
  @IsOptional()
  expiresAt?: string;
}

export class TeacherLecturePermissionResponseDto {
  @ApiProperty({ description: 'ID của permission record' })
  id: string;

  @ApiProperty({ description: 'ID của bài giảng' })
  lectureId: string;

  @ApiProperty({ description: 'ID của giáo viên' })
  teacherId: string;

  @ApiProperty({
    description: 'Loại quyền',
    enum: PermissionType,
  })
  permissionType: PermissionType;

  @ApiProperty({ description: 'ID của người cấp quyền' })
  grantedBy: string;

  @ApiPropertyOptional({ description: 'Ngày hết hạn' })
  expiresAt?: Date;

  @ApiProperty({ description: 'Ngày tạo' })
  createdAt: Date;

  @ApiProperty({ description: 'Ngày cập nhật' })
  updatedAt: Date;
}
