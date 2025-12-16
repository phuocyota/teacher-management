import {
  IsBoolean,
  IsDate,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { UserType } from '../../common/enum/user-type.enum.js';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { Status } from '../enum/status.enum.js';
import { Gender } from '../enum/gender.enum.js';

export class CreateUserDto {
  // ===== Thông tin đăng nhập =====
  @ApiProperty({
    example: 'john_doe',
    description: 'Tên đăng nhập của người dùng (duy nhất)',
  })
  @IsNotEmpty({ message: 'Tên đăng nhập không được để trống' })
  @IsString()
  userName!: string;

  @ApiProperty({
    example: 'Password@123',
    description: 'Mật khẩu của người dùng (tối thiểu 6 ký tự)',
  })
  @IsNotEmpty({ message: 'Mật khẩu không được để trống' })
  @MinLength(6, { message: 'Mật khẩu phải có ít nhất 6 ký tự' })
  password!: string;

  @ApiProperty({
    example: 'nguyenvana@school.edu.vn',
    description: 'Email của người dùng (duy nhất)',
  })
  @IsNotEmpty({ message: 'Email không được để trống' })
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email!: string;

  // ===== Thông tin cá nhân =====
  @ApiPropertyOptional({
    example: 'Nguyễn Văn A',
    description: 'Tên đầy đủ của người dùng',
  })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional({
    example: '0901234567',
    description: 'Số điện thoại của người dùng',
  })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiPropertyOptional({
    example: '1990-01-15',
    description: 'Ngày sinh của người dùng',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'Ngày sinh không hợp lệ' })
  birthday?: Date;

  @ApiPropertyOptional({
    example: 'MALE',
    description: 'Giới tính của người dùng',
    enum: Gender,
  })
  @IsOptional()
  @IsEnum(Gender, { message: 'Giới tính không hợp lệ' })
  gender?: Gender;

  @ApiPropertyOptional({
    example: '001234567890',
    description: 'Số CMND/CCCD của người dùng',
  })
  @IsOptional()
  @IsString()
  citizenId?: string;

  @ApiPropertyOptional({
    example: '123 Đường ABC, Quận 1, TP.HCM',
    description: 'Địa chỉ của người dùng',
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({
    example: 'Ghi chú về người dùng',
    description: 'Ghi chú',
  })
  @IsOptional()
  @IsString()
  note?: string;

  // ===== Loại người dùng =====
  @ApiProperty({
    example: 'TEACHER',
    description: 'Loại người dùng',
    enum: UserType,
  })
  @IsNotEmpty({ message: 'Loại người dùng không được để trống' })
  @IsEnum(UserType, { message: 'Loại người dùng không hợp lệ' })
  userType!: UserType;

  // ===== Thời hạn =====
  @ApiPropertyOptional({
    example: '2024-01-01',
    description: 'Ngày kích hoạt tài khoản',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'Ngày kích hoạt không hợp lệ' })
  activatedDate?: Date;

  @ApiPropertyOptional({
    example: '2025-12-31',
    description: 'Ngày hết hạn tài khoản',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'Ngày hết hạn không hợp lệ' })
  expiredDate?: Date;

  // ===== Quyền (checkbox) =====
  @ApiPropertyOptional({
    example: false,
    description: 'Quyền tạo mã giáo viên',
  })
  @IsOptional()
  @IsBoolean()
  canCreateTeacherCode?: boolean;

  @ApiPropertyOptional({
    example: false,
    description: 'Quyền tạo mã admin',
  })
  @IsOptional()
  @IsBoolean()
  canCreateAdminCode?: boolean;

  @ApiPropertyOptional({
    example: false,
    description: 'Quyền thêm bài giảng',
  })
  @IsOptional()
  @IsBoolean()
  canAddLesson?: boolean;

  @ApiPropertyOptional({
    example: false,
    description: 'Quyền cập nhật bài giảng',
  })
  @IsOptional()
  @IsBoolean()
  canUpdateLesson?: boolean;

  @ApiPropertyOptional({
    example: false,
    description: 'Quyền quản lý bài giảng',
  })
  @IsOptional()
  @IsBoolean()
  canManageLesson?: boolean;

  @ApiPropertyOptional({
    example: false,
    description: 'Quyền quản lý tài khoản',
  })
  @IsOptional()
  @IsBoolean()
  canManageAccount?: boolean;

  @ApiPropertyOptional({
    example: false,
    description: 'Là tài khoản liên kết',
  })
  @IsOptional()
  @IsBoolean()
  isLinkedAccount?: boolean;

  @ApiPropertyOptional({
    example: 'ACTIVE',
    description: 'Trạng thái người dùng',
    enum: Status,
  })
  @IsOptional()
  @IsEnum(Status, { message: 'Trạng thái không hợp lệ' })
  status?: Status;
}
