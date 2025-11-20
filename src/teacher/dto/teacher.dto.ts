import { IsString, IsEmail, IsOptional } from 'class-validator';

export class CreateTeacherDto {
  @IsString()
  name: string;

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
