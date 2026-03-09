import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEmail, IsOptional } from 'class-validator';

export class CreateTeacherDto {
  @ApiProperty({
    example: 'GV001',
    description: 'Ma giao vien',
  })
  @IsString()
  code!: string;

  @ApiProperty({
    example: 'teacher123',
    description: 'Ma dinh danh thiet bi cua giao vien',
  })
  @IsString()
  deviceId!: string;

  @ApiProperty({
    example: 'Nguyen Van A',
    description: 'Ten giao vien',
  })
  @IsString()
  name?: string;

  @ApiProperty({
    example: 'nguyenvana@gmail.com',
    description: 'Email giao vien',
  })
  @IsEmail()
  email!: string;
}

export class UpdateTeacherDto {
  @ApiProperty({
    example: 'GV001',
    description: 'Ma giao vien',
  })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiProperty({
    example: 'teacher123',
    description: 'Ma dinh danh thiet bi cua giao vien',
  })
  @IsString()
  deviceId?: string;

  @ApiProperty({
    example: 'Nguyen Van A',
    description: 'Ten giao vien',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({
    example: 'nguyenvana@gmail.com',
    description: 'Email giao vien',
  })
  @IsOptional()
  @IsEmail()
  email?: string;
}
