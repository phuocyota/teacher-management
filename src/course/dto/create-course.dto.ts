import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsInt,
  Min,
  IsEnum,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import { Status } from 'src/common/enum/status.enum';

export class CreateCourseDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ description: 'course code', example: 'CS101' })
  code!: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    description: 'Course name',
    example: 'Introduction to Computer Science',
  })
  name!: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description: 'Course description',
    example: 'Fundamental concepts of CS',
  })
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @ApiPropertyOptional({
    description: 'Number of credits',
    example: 3,
    minimum: 0,
  })
  credits?: number;

  @IsOptional()
  @IsEnum(Status)
  @ApiPropertyOptional({
    description: 'Course status',
    enum: Status,
    default: Status.ACTIVE,
  })
  status?: Status;

  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional({
    description: 'Start date (ISO 8601)',
    example: '2025-01-15',
  })
  startDate?: string;
  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description: 'Course image URL',
    example: 'https://cdn.example.com/courses/cs101.png',
  })
  image?: string;
  endDate?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description: 'Additional note',
    example: 'Requires basic math knowledge',
  })
  note?: string;

  @IsOptional()
  @IsUUID()
  @ApiPropertyOptional({
    description: 'ID of the class this course belongs to',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  classId?: string;
}

export class UpdateCourseDto {
  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description: 'Course name',
    example: 'Intro to CS - Updated',
  })
  name?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description: 'Course description',
    example: 'Updated fundamentals',
  })
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @ApiPropertyOptional({
    description: 'Number of credits',
    example: 4,
    minimum: 0,
  })
  credits?: number;

  @IsOptional()
  @IsEnum(Status)
  @ApiPropertyOptional({ description: 'Course status', enum: Status })
  status?: Status;

  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional({
    description: 'Start date (ISO 8601)',
    example: '2025-01-20',
  })
  startDate?: string;

  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional({
    description: 'End date (ISO 8601)',
    example: '2025-06-01',
  })
  endDate?: string;

  @IsOptional()
  @IsUUID()
  @ApiPropertyOptional({
    description: 'ID of the class this course belongs to',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  classId?: string;
}
