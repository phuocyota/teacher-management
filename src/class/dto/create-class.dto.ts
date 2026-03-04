import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { DisplayType } from '../enum/display-type.enum';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateClassDto {
  @ApiPropertyOptional({
    description: 'Ma lop hoc',
    example: 'CS101',
  })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiPropertyOptional({
    description: 'Ten lop hoc',
    example: 'Lop Khoa hoc May tinh 101',
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    description: 'So thu tu cua lop hoc',
    example: 1,
  })
  @IsNumber()
  orderNumber!: number;

  @ApiPropertyOptional({
    description: 'Loai hien thi cua lop hoc',
    example: DisplayType.BASIC,
  })
  @IsEnum(DisplayType)
  displayType!: DisplayType;

  @ApiPropertyOptional({
    description: 'Anh hien tai cua lop hoc',
    example: 'https://example.com/current-image.jpg',
  })
  @IsOptional()
  @IsString()
  currentImage?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({
    description: 'ID khoi',
    example: '7de93ed8-e016-4d85-9644-11e22bb728f6',
  })
  @IsOptional()
  @IsUUID()
  gradeId?: string;

  @ApiPropertyOptional({
    description: 'ID mon hoc',
    example: '4d30e3c2-d08d-4b43-b2d1-2c3f5876f0ad',
  })
  @IsOptional()
  @IsUUID()
  subjectId?: string;
}

export class UpdateClassDto {
  @ApiPropertyOptional({
    description: 'Ma lop hoc',
    example: 'CS101-Updated',
  })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({
    description: 'Ten lop hoc',
    example: 'Lop Khoa hoc May tinh 101 - Cap nhat',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'So thu tu cua lop hoc',
    example: 2,
  })
  @IsOptional()
  @IsNumber()
  orderNumber?: number;

  @ApiPropertyOptional({
    description: 'Loai hien thi cua lop hoc',
    example: DisplayType.BASIC,
  })
  @IsOptional()
  @IsEnum(DisplayType)
  displayType?: DisplayType;

  @ApiPropertyOptional({
    description: 'Anh hien tai cua lop hoc',
    example: 'https://example.com/current-image-updated.jpg',
  })
  @IsOptional()
  @IsString()
  currentImage?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({
    description: 'ID khoi',
    example: '7de93ed8-e016-4d85-9644-11e22bb728f6',
  })
  @IsOptional()
  @IsUUID()
  gradeId?: string;

  @ApiPropertyOptional({
    description: 'ID mon hoc',
    example: '4d30e3c2-d08d-4b43-b2d1-2c3f5876f0ad',
  })
  @IsOptional()
  @IsUUID()
  subjectId?: string;
}
