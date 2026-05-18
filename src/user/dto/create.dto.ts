import {
  IsBoolean,
  IsDate,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  IsArray,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { UserType } from '../../common/enum/user-type.enum.js';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { Status } from '../enum/status.enum.js';
import { Gender } from '../enum/gender.enum.js';

export class CreateUserDto {
  @ApiProperty({
    example: 'john_doe',
    description: 'Ten dang nhap cua nguoi dung',
  })
  @IsNotEmpty({ message: 'Ten dang nhap khong duoc de trong' })
  @IsString()
  userName!: string;

  @ApiProperty({
    example: 'Password@123',
    description: 'Mat khau cua nguoi dung',
  })
  @IsNotEmpty({ message: 'Mat khau khong duoc de trong' })
  @MinLength(6, { message: 'Mat khau phai co it nhat 6 ky tu' })
  password!: string;

  @ApiPropertyOptional({
    example: 'nguyenvana@school.edu.vn',
    description: 'Email cua nguoi dung',
  })
  @IsOptional()
  @IsEmail({}, { message: 'Email khong hop le' })
  email?: string;

  @ApiPropertyOptional({
    example: 'Nguyen Van A',
    description: 'Ten day du cua nguoi dung',
  })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional({
    example: '0901234567',
    description: 'So dien thoai cua nguoi dung',
  })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiPropertyOptional({
    example: 'https://example.com/avatar.jpg',
    description: 'Avatar cua nguoi dung',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'avatar khong duoc vuot qua 2000 ky tu' })
  avatar?: string;

  @ApiPropertyOptional({
    example: '1990-01-15',
    description: 'Ngay sinh cua nguoi dung',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'Ngay sinh khong hop le' })
  birthday?: Date;

  @ApiPropertyOptional({
    example: 'MALE',
    description: 'Gioi tinh cua nguoi dung',
    enum: Gender,
  })
  @IsOptional()
  @IsEnum(Gender, { message: 'Gioi tinh khong hop le' })
  gender?: Gender;

  @ApiPropertyOptional({
    example: '001234567890',
    description: 'So CMND/CCCD cua nguoi dung',
  })
  @IsOptional()
  @IsString()
  citizenId?: string;

  @ApiPropertyOptional({
    example: '04AABBCCDD',
    description: 'NFC ID cua nguoi dung',
  })
  @IsOptional()
  @IsString()
  nfcId?: string;

  @ApiPropertyOptional({
    example: '123 Duong ABC, Quan 1, TP.HCM',
    description: 'Dia chi cua nguoi dung',
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({
    example: 'Ghi chu ve nguoi dung',
    description: 'Ghi chu',
  })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiProperty({
    example: 'TEACHER',
    description: 'Loai nguoi dung',
    enum: UserType,
  })
  @IsNotEmpty({ message: 'Loai nguoi dung khong duoc de trong' })
  @IsEnum(UserType, { message: 'Loai nguoi dung khong hop le' })
  userType!: UserType;

  @ApiPropertyOptional({
    example: '2024-01-01',
    description: 'Ngay kich hoat tai khoan',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'Ngay kich hoat khong hop le' })
  activatedDate?: Date;

  @ApiPropertyOptional({
    example: '2025-12-31',
    description: 'Ngay het han tai khoan',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'Ngay het han khong hop le' })
  expiredDate?: Date;

  @ApiPropertyOptional({
    example: false,
    description: 'Quyen tao ma giao vien',
  })
  @IsOptional()
  @IsBoolean()
  canCreateTeacherCode?: boolean;

  @ApiPropertyOptional({
    example: false,
    description: 'Quyen tao ma admin',
  })
  @IsOptional()
  @IsBoolean()
  canCreateAdminCode?: boolean;

  @ApiPropertyOptional({
    example: false,
    description: 'Quyen them bai giang',
  })
  @IsOptional()
  @IsBoolean()
  canAddLesson?: boolean;

  @ApiPropertyOptional({
    example: false,
    description: 'Quyen cap nhat bai giang',
  })
  @IsOptional()
  @IsBoolean()
  canUpdateLesson?: boolean;

  @ApiPropertyOptional({
    example: false,
    description: 'Quyen quan ly bai giang',
  })
  @IsOptional()
  @IsBoolean()
  canManageLesson?: boolean;

  @ApiPropertyOptional({
    example: false,
    description: 'Quyen quan ly tai khoan',
  })
  @IsOptional()
  @IsBoolean()
  canManageAccount?: boolean;

  @ApiPropertyOptional({
    example: false,
    description: 'La tai khoan lien ket',
  })
  @IsOptional()
  @IsBoolean()
  isLinkedAccount?: boolean;

  @ApiPropertyOptional({
    example: 'ACTIVE',
    description: 'Trang thai nguoi dung',
    enum: Status,
  })
  @IsOptional()
  @IsEnum(Status, { message: 'Trang thai khong hop le' })
  status?: Status;

  @ApiPropertyOptional({
    example: ['group-uuid-1', 'group-uuid-2'],
    description: 'Danh sach group IDs de them user vao',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  groupIds?: string[];

  @ApiPropertyOptional({
    example: '3344abe3-1961-4af5-a482-542f1227d855',
    description: 'ID nhom hoc sinh, dung khi tao user loai STUDENT',
  })
  @IsOptional()
  @IsUUID('4')
  studentGroupId?: string | null;

  @ApiPropertyOptional({
    example: '2233abe3-1961-4af5-a482-542f1227d844',
    description: 'ID truong hoc, dung khi tao user loai STUDENT',
  })
  @IsOptional()
  @IsUUID('4')
  schoolId?: string | null;

  @ApiPropertyOptional({
    example: 'HS001',
    description: 'Code, dung khi tao user loai STUDENT',
  })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({
    example: 'HS001',
    description: 'Ma hoc sinh, dung de tuong thich nguoc',
  })
  @IsOptional()
  @IsString()
  studentCode?: string;

  @ApiPropertyOptional({
    example: 'teacher-device-001',
    description: 'Device ID, dung khi tao user loai TEACHER',
  })
  @IsOptional()
  @IsString()
  deviceId?: string;

  @ApiPropertyOptional({
    example: 'GV001',
    description: 'Ma giao vien, dung khi tao user loai TEACHER',
  })
  @IsOptional()
  @IsString()
  teacherCode?: string;
}
