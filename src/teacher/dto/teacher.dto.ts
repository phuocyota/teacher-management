import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEmail, IsOptional } from 'class-validator';

export class CreateTeacherDto {
  @ApiProperty({
    example: 'teacher123',
    description: 'Mã định danh thiết bị của giáo viên',
  })
  @IsString()
  deviceId!: string;

  @ApiProperty({
    example: 'Nguyen Van A',
    description: 'Tên giáo viên',
  })
  @IsString()
  name?: string;

  @ApiProperty({
    example: 'nguyenvana@gmail.com',
    description: 'Email giáo viên',
  })
  @IsEmail()
  email!: string;
}

export class UpdateTeacherDto {
  @ApiProperty({
    example: 'teacher123',
    description: 'Mã định danh thiết bị của giáo viên',
  })
  @IsString()
  deviceId?: string;

  @ApiProperty({
    example: 'Nguyen Van A',
    description: 'Tên giáo viên',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({
    example: 'nguyenvana@gmail.com',
    description: 'Email giáo viên',
  })
  @IsOptional()
  @IsEmail()
  email?: string;
}
