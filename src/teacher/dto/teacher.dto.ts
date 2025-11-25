import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEmail, IsOptional } from 'class-validator';

export class CreateTeacherDto {
  @ApiProperty({
    example: 'Nguyen Van A',
    description: 'Tên giáo viên',
  })
  @IsString()
  name: string;

  @ApiProperty()
  @IsEmail()
  email: string;
}

export class UpdateTeacherDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}
