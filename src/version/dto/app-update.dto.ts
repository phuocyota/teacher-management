import { Transform, TransformFnParams } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
} from 'class-validator';

const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const PLATFORM_PATTERN = /^[a-z0-9-]+$/;

function normalizePlatform({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}

function trimString({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class CreateAppVersionDto {
  @ApiProperty({ example: 'mac' })
  @Transform(normalizePlatform)
  @IsString()
  @IsNotEmpty()
  @Matches(PLATFORM_PATTERN)
  platform!: string;

  @ApiProperty({ example: '1.0.2' })
  @Transform(trimString)
  @IsString()
  @Matches(VERSION_PATTERN, {
    message: 'version phải có định dạng semantic version, ví dụ 1.0.2',
  })
  version!: string;

  @ApiProperty({
    example: 'https://domain.com/releases/mac/KidoTeacher-1.0.2.zip',
  })
  @IsString()
  @IsUrl({ require_tld: false })
  downloadUrl!: string;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  mandatory?: boolean;

  @ApiPropertyOptional({ example: 'Sửa lỗi và cải thiện hiệu năng' })
  @IsOptional()
  @IsString()
  note?: string;
}

export class CheckAppVersionQueryDto {
  @ApiProperty({ example: 'mac' })
  @Transform(normalizePlatform)
  @IsString()
  @IsNotEmpty()
  @Matches(PLATFORM_PATTERN)
  platform!: string;

  @ApiProperty({ example: '1.0.0' })
  @Transform(trimString)
  @IsString()
  @Matches(VERSION_PATTERN, {
    message: 'currentVersion phải có định dạng semantic version, ví dụ 1.0.0',
  })
  currentVersion!: string;
}

export class ListAppVersionsQueryDto {
  @ApiPropertyOptional({ example: 'android' })
  @Transform(normalizePlatform)
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Matches(PLATFORM_PATTERN)
  platform?: string;
}

export class AppVersionResponseDto {
  @ApiProperty({ example: 'ccdd8aae-dc37-4c03-9d3f-bdaab40f748f' })
  id!: string;

  @ApiProperty({ example: 'mac' })
  platform!: string;

  @ApiProperty({ example: '1.0.2' })
  version!: string;

  @ApiProperty({
    example: 'https://domain.com/releases/mac/KidoTeacher-1.0.2.zip',
  })
  url!: string;

  @ApiProperty({ example: false })
  mandatory!: boolean;

  @ApiPropertyOptional({
    example: 'Sửa lỗi và cải thiện hiệu năng',
    nullable: true,
  })
  note!: string | null;
}

export class AppVersionListItemDto extends OmitType(AppVersionResponseDto, [
  'note',
] as const) {
  @ApiPropertyOptional({ example: 'Duolingo', nullable: true })
  name?: string | null;

  @ApiPropertyOptional({
    example: 'Sửa lỗi và cải thiện hiệu năng',
    nullable: true,
  })
  note?: string | null;
}

export class CheckAppVersionResponseDto {
  @ApiProperty({ example: true })
  hasUpdate!: boolean;

  @ApiProperty({ example: '1.0.0' })
  currentVersion!: string;

  @ApiProperty({ example: '1.0.2', nullable: true })
  latestVersion!: string | null;

  @ApiProperty({ example: false })
  mandatory!: boolean;

  @ApiPropertyOptional({
    example: 'https://domain.com/releases/mac/KidoTeacher-1.0.2.zip',
    nullable: true,
  })
  downloadUrl!: string | null;

  @ApiPropertyOptional({
    example: 'Sửa lỗi và cải thiện hiệu năng',
    nullable: true,
  })
  note!: string | null;
}
