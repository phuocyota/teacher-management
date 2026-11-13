import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class RegisterStudentDto {
  @ApiPropertyOptional({
    description: 'Legacy input; ignored. BE generates the login ID.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  userName?: string;

  @ApiProperty({ minLength: 6, maxLength: 72 })
  @IsString()
  @MinLength(6)
  @MaxLength(72)
  password!: string;

  @ApiProperty()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  fullName!: string;

  @ApiPropertyOptional({ description: 'Khu vực đã chọn khi đăng ký' })
  @IsOptional()
  @IsUUID()
  zoneId?: string;

  @ApiPropertyOptional({ description: 'Chọn ID trường hoặc nhập schoolName' })
  @ValidateIf(
    (dto: RegisterStudentDto) => dto.schoolId !== undefined || !dto.schoolName,
  )
  @IsUUID()
  schoolId?: string;

  @ApiPropertyOptional({ description: 'Chọn ID lớp hoặc nhập className' })
  @ValidateIf(
    (dto: RegisterStudentDto) => dto.classId !== undefined || !dto.className,
  )
  @IsUUID()
  classId?: string;

  @ApiPropertyOptional({ maxLength: 255 })
  @Transform(trim)
  @ValidateIf(
    (dto: RegisterStudentDto) => dto.schoolName !== undefined || !dto.schoolId,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  schoolName?: string;

  @ApiPropertyOptional({ maxLength: 255 })
  @Transform(trim)
  @ValidateIf(
    (dto: RegisterStudentDto) => dto.className !== undefined || !dto.classId,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  className?: string;

  @ApiPropertyOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string'
      ? value.replace(/[\s().-]/g, '') || undefined
      : value,
  )
  @IsOptional()
  @IsString()
  @Matches(/^(?:0|\+84|84)[35789]\d{8}$/, {
    message: 'Số điện thoại Việt Nam không hợp lệ.',
  })
  phoneNumber?: string;
}
