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
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class RegisterStudentDto {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Matches(/^[a-zA-Z0-9_.-]{3,50}$/, {
    message:
      'ID phải có 3–50 ký tự, chỉ gồm chữ, số, dấu chấm, gạch dưới hoặc gạch ngang.',
  })
  userName!: string;

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

  @ApiProperty()
  @IsUUID()
  schoolId!: string;

  @ApiProperty()
  @IsUUID()
  classId!: string;

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
