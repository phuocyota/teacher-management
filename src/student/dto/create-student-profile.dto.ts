import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateStudentProfileDto {
  @ApiProperty({ example: 'https://example.com/uploads/student.jpg' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  @Matches(/^(https?:\/\/[^\s]+|\/uploads\/[^\s]+)$/i, {
    message: 'image must be an HTTP(S) URL or an /uploads/ path',
  })
  image!: string;

  @ApiProperty({ example: 'Nguyễn Văn An' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fullName!: string;

  @ApiProperty({
    example: '2233abe3-1961-4af5-a482-542f1227d844',
    description: 'ID trường học',
  })
  @Transform(trim)
  @IsUUID()
  schoolId!: string;

  @ApiProperty({
    example: '3344abe3-1961-4af5-a482-542f1227d855',
    description: 'ID lớp học (studentGroupId)',
  })
  @Transform(trim)
  @IsUUID()
  classId!: string;

  @ApiProperty({ example: '0901234567' })
  @Transform(trim)
  @IsString()
  @Matches(/^\+?[0-9][0-9 ().-]{6,23}$/, {
    message: 'phone must be a phone number string',
  })
  phone!: string;
}
