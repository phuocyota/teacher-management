import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
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
  @IsUUID()
  @ApiPropertyOptional({
    description: 'ID khu vuc',
    example: '2233abe3-1961-4af5-a482-542f1227d844',
    nullable: true,
  })
  zoneId?: string | null;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description: 'Địa chỉ trường học',
    example: '123 Đường ABC, Quận 1, TP.HCM',
  })
  address?: string;
}

export class UpdateSchoolDto extends PartialType(CreateSchoolDto) {}
