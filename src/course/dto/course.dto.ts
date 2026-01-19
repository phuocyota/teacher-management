import { ApiProperty } from '@nestjs/swagger';

export class CourseResponseDto {
  @ApiProperty({
    description: 'Course ID',
    example: 'c8b3f8e2-1234-5678-9abc-def012345678',
  })
  id!: string;

  @ApiProperty({
    description: 'Unique course code',
    example: 'CS101',
  })
  code!: string;

  @ApiProperty({
    description: 'Course name',
    example: 'Introduction to Computer Science',
  })
  name!: string;

  @ApiProperty({
    description: 'Course image URL',
    example: 'https://cdn.example.com/courses/cs101.png',
    required: false,
  })
  image?: string;

  @ApiProperty({
    description: 'Additional note',
    example: 'Requires basic math knowledge',
    required: false,
  })
  note?: string;

  @ApiProperty({
    description: 'Created at timestamp (ISO)',
    example: '2025-01-01T12:00:00.000Z',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'Updated at timestamp (ISO)',
    example: '2025-01-10T12:00:00.000Z',
  })
  updatedAt!: Date;

  @ApiProperty({
    description: 'User ID who created',
    required: false,
  })
  createdBy?: string;

  @ApiProperty({
    description: 'User ID who last updated',
    required: false,
  })
  updatedBy?: string;
}

export class CourseListResponseDto {
  @ApiProperty({ type: [CourseResponseDto] })
  data!: CourseResponseDto[];

  @ApiProperty({
    description: 'Page number',
    example: 1,
  })
  page!: number;

  @ApiProperty({
    description: 'Page size',
    example: 10,
  })
  size!: number;

  @ApiProperty({
    description: 'Total items',
    example: 42,
  })
  total!: number;
}
