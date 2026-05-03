import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { UserType } from '../../common/enum/user-type.enum.js';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';
import { Status } from '../enum/status.enum.js';
import { Gender } from '../enum/gender.enum.js';
import { CertificateLevel } from '../../common/enum/certificate-level.enum.js';
import { CertificateSubject } from '../../common/enum/certificate-subject.enum.js';

// ===== CHANGE PASSWORD DTO =====
export class ChangePasswordDto {
  @ApiProperty({
    example: 'OldPassword@123',
    description: 'Mật khẩu hiện tại',
  })
  @IsNotEmpty({ message: 'Mật khẩu hiện tại không được để trống' })
  currentPassword!: string;

  @ApiProperty({
    example: 'NewPassword@456',
    description: 'Mật khẩu mới (tối thiểu 6 ký tự)',
  })
  @IsNotEmpty({ message: 'Mật khẩu mới không được để trống' })
  @MinLength(6, { message: 'Mật khẩu mới phải có ít nhất 6 ký tự' })
  newPassword!: string;
}

export class ChangePasswordResponseDto {
  @ApiProperty({
    example: 'Đổi mật khẩu thành công',
    description: 'Thông báo kết quả',
  })
  message: string;
}

// ===== USER RESPONSE DTO (không trả về password) =====
@Exclude()
export class UserResponseDto {
  @Expose()
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  @Expose()
  @ApiProperty({ example: 'john_doe' })
  userName: string;

  @Expose()
  @ApiPropertyOptional({ example: 'Nguyễn Văn A' })
  fullName?: string;

  @Expose()
  @ApiProperty({ example: 'nguyenvana@school.edu.vn' })
  email: string;

  @Expose()
  @ApiPropertyOptional({ example: '0901234567' })
  phoneNumber?: string;

  @Expose()
  @ApiPropertyOptional({ example: 'https://example.com/avatar.jpg' })
  avatar?: string;

  @Expose()
  @ApiPropertyOptional({ example: '1990-01-15' })
  birthday?: Date;

  @Expose()
  @ApiPropertyOptional({ example: 'MALE', enum: Gender })
  gender?: Gender;

  @Expose()
  @ApiPropertyOptional({ example: '001234567890' })
  citizenId?: string;

  @Expose()
  @ApiPropertyOptional({ example: '123 Đường ABC, Quận 1, TP.HCM' })
  address?: string;

  @Expose()
  @ApiPropertyOptional({ example: 'Ghi chú' })
  note?: string;

  @Expose()
  @ApiProperty({ example: 'TEACHER', enum: UserType })
  userType: UserType;

  @Expose()
  @ApiPropertyOptional({ example: 'ACTIVE', enum: Status })
  status?: Status;

  @Expose()
  @ApiProperty({ example: false })
  isDisabled: boolean;

  // ===== Thông tin sử dụng =====
  @Expose()
  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  createdAt: Date;

  @Expose()
  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  updatedAt: Date;
}

export class CertificateResponseDto {
  @Expose()
  @ApiProperty({ example: 1 })
  id: number;

  @Expose()
  @ApiProperty({ example: 'Nguyễn Văn A' })
  name: string;

  @Expose()
  @ApiProperty({ example: '10A' })
  className: string;

  @Expose()
  @ApiProperty({ example: 'THPT X' })
  school: string;

  @Expose()
  @ApiProperty({ example: '2026-05-04' })
  date: string;

  @Expose()
  @ApiProperty({ example: CertificateSubject.STEM, enum: CertificateSubject })
  subject: CertificateSubject | string;

  @Expose()
  @ApiProperty({
    example: CertificateLevel.GOOD_COMPLETION,
    enum: CertificateLevel,
  })
  level: CertificateLevel;
}

export class MeResponseDto extends UserResponseDto {
  @Expose()
  @ApiPropertyOptional({ example: 'HS001' })
  studentCode?: string;

  @Expose()
  @ApiPropertyOptional({
    example: 'Lop 1A',
    description: 'Ten lop/nhom hoc sinh, chi co voi user STUDENT',
  })
  className?: string;

  @Expose()
  @ApiPropertyOptional({
    example: 'Truong Tieu hoc Nguyen Hue',
    description: 'Ten truong hoc, chi co voi user STUDENT',
  })
  schoolName?: string;

  @Expose()
  @ApiPropertyOptional({
    type: [CertificateResponseDto],
    description: 'Danh sach chung chi, chi co voi user STUDENT',
    example: [
      {
        id: 1,
        name: 'Nguyễn Văn A',
        className: '10A',
        school: 'THPT X',
        date: '2026-05-04',
        subject: 'STEM',
        level: CertificateLevel.GOOD_COMPLETION,
      },
    ],
  })
  certificates?: CertificateResponseDto[];
}

// ===== USER LIST QUERY DTO (cho filter & pagination) =====
export class UserQueryDto {
  @ApiPropertyOptional({
    example: 1,
    description: 'Số trang (mặc định: 1)',
  })
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({
    example: 10,
    description: 'Số bản ghi mỗi trang (mặc định: 10)',
  })
  @IsOptional()
  limit?: number = 10;

  @ApiPropertyOptional({
    example: 'nguyen',
    description: 'Tìm kiếm theo tên hoặc email',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    example: 'TEACHER',
    description: 'Lọc theo loại người dùng',
    enum: UserType,
  })
  @IsOptional()
  @IsEnum(UserType)
  userType?: UserType;

  @ApiPropertyOptional({
    example: 'ACTIVE',
    description: 'Lọc theo trạng thái',
    enum: Status,
  })
  @IsOptional()
  @IsEnum(Status)
  status?: Status;

  @ApiPropertyOptional({
    example: false,
    description: 'Lọc theo trạng thái vô hiệu hóa',
  })
  @IsOptional()
  @IsBoolean()
  isDisabled?: boolean;

  @ApiPropertyOptional({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description: 'Lọc theo group ID',
  })
  @IsOptional()
  @IsString()
  groupId?: string;

  @ApiPropertyOptional({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description: 'Loại bỏ user đã thuộc group ID này',
  })
  @IsOptional()
  @IsString()
  excludeGroupId?: string;
}
