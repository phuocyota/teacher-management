import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { DisplayType } from './enum/display-type.enum';

export class CreateClassDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsNumber()
  orderNumber!: number;

  @IsEnum(DisplayType)
  displayType!: DisplayType;

  @IsOptional()
  @IsString()
  avatarImage?: string;

  @IsOptional()
  @IsString()
  currentImage?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateClassDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumber()
  orderNumber?: number;

  @IsOptional()
  @IsEnum(DisplayType)
  displayType?: DisplayType;

  @IsOptional()
  @IsString()
  avatarImage?: string;

  @IsOptional()
  @IsString()
  currentImage?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
