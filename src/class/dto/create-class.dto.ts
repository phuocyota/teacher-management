import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { DisplayType } from '../enum/display-type.enum';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateClassDto {
  @ApiPropertyOptional({
    description: 'Mã lớp học',
    example: 'CS101',
  })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiPropertyOptional({
    description: 'Tên lớp học',
    example: 'Lớp Khoa học Máy tính 101',
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    description: 'Số thứ tự của lớp học',
    example: 1,
  })
  @IsNumber()
  orderNumber!: number;

  @ApiPropertyOptional({
    description: 'Loại hiển thị của lớp học',
    example: DisplayType.BASIC,
  })
  @IsEnum(DisplayType)
  displayType!: DisplayType;

  @ApiPropertyOptional({
    description: 'Ảnh hiện tại của lớp học',
    example: 'https://example.com/current-image.jpg',
  })
  @IsOptional()
  @IsString()
  currentImage?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateClassDto {
  @ApiPropertyOptional({
    description: 'Mã lớp học',
    example: 'CS101-Updated',
  })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({
    description: 'Tên lớp học',
    example: 'Lớp Khoa học Máy tính 101 - Cập nhật',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Số thứ tự của lớp học',
    example: 2,
  })
  @IsOptional()
  @IsNumber()
  orderNumber?: number;

  @ApiPropertyOptional({
    description: 'Loại hiển thị của lớp học',
    example: DisplayType.BASIC,
  })
  @IsOptional()
  @IsEnum(DisplayType)
  displayType?: DisplayType;

  @ApiPropertyOptional({
    description: 'Ảnh hiện tại của lớp học',
    example: 'https://example.com/current-image-updated.jpg',
  })
  @IsOptional()
  @IsString()
  currentImage?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
