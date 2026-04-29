import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class CreateSchoolDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    description: 'Mã trường học (unique)',
    example: 'SCH001',
  })
  code!: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    description: 'Tên trường học',
    example: 'Trường THPT Nguyễn Huệ',
  })
  name!: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description: 'Địa chỉ trường học',
    example: '123 Đường ABC, Quận 1, TP.HCM',
  })
  address?: string;
}

export class UpdateSchoolDto extends PartialType(CreateSchoolDto) {}
