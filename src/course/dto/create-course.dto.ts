import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CreateCourseDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ description: 'Course code', example: 'CS101' })
  code!: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    description: 'Course name',
    example: 'Introduction to Computer Science',
  })
  name!: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    description: 'Image filename or URL',
    example: '1767928564252-372536774.png',
  })
  image!: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description: 'Additional note',
    example: 'Requires basic math knowledge',
  })
  note?: string;

  @IsUUID()
  @IsNotEmpty()
  @ApiProperty({
    description: 'Class ID this course belongs to',
    example: '2233abe3-1961-4af5-a482-542f1227d844',
  })
  classId!: string;
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
    description: 'Image filename or URL',
    example: '1767928564252-372536774.png',
  })
  image?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description: 'Additional note',
    example: 'Updated note',
  })
  note?: string;

  @IsOptional()
  @IsUUID()
  @ApiPropertyOptional({ description: 'Class ID this course belongs to' })
  classId?: string;
}
