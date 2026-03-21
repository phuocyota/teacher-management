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

export class CourseOptionDto {
  @ApiProperty({
    description: 'Course ID used as option value',
    example: 'course_001',
  })
  value!: string;

  @ApiProperty({
    description: 'Course name used as option label',
    example: 'Toán 1',
  })
  label!: string;

  @ApiProperty({
    description: 'Course code',
    example: 'C001',
  })
  code!: string;

  @ApiProperty({
    description: 'Course name',
    example: 'Toán 1',
  })
  name!: string;

  @ApiProperty({
    description: 'Related class ID',
    example: 'class_01',
    required: false,
  })
  classId?: string;

  @ApiProperty({
    description: 'Related class code',
    example: 'K1',
    required: false,
  })
  classCode?: string;

  @ApiProperty({
    description: 'Related class name',
    example: 'Khối 1',
    required: false,
  })
  className?: string;
}

<<<<<<< HEAD
export class ClassOptionDto {
  @ApiProperty({
    description: 'Class ID used as option value',
    example: 'class_001',
  })
  value!: string;

  @ApiProperty({
    description: 'Class label used in combobox',
    example: '15 - CDS_Khoi 1',
  })
  label!: string;

  @ApiProperty({
    description: 'Class code',
    example: '15',
  })
  code!: string;

  @ApiProperty({
    description: 'Class name',
    example: 'CDS_Khoi 1',
  })
  name!: string;
}

export class LectureOptionDto {
  @ApiProperty({
    description: 'Lecture ID used as option value',
    example: 'lecture_001',
  })
  value!: string;

  @ApiProperty({
    description: 'Lecture title used as option label',
    example: 'K5_T4_Tuan 1_Ky nang ung xu',
  })
  label!: string;

  @ApiProperty({
    description: 'Lecture code',
    example: 'BG001',
    required: false,
  })
  code?: string;

  @ApiProperty({
    description: 'Lecture title',
    example: 'K5_T4_Tuan 1_Ky nang ung xu',
  })
  title!: string;

  @ApiProperty({
    description: 'Related class ID',
    example: 'class_01',
  })
  classId!: string;

  @ApiProperty({
    description: 'Related course ID',
    example: 'course_01',
  })
  courseId!: string;
}

=======
>>>>>>> b3aba5bb7454c60bed62b01cee6c963b9afbc016
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

export class CourseOptionListResponseDto {
  @ApiProperty({ type: [CourseOptionDto] })
  data!: CourseOptionDto[];

<<<<<<< HEAD
  @ApiProperty({ type: [ClassOptionDto] })
  classes!: ClassOptionDto[];

  @ApiProperty({ type: [CourseOptionDto] })
  courses!: CourseOptionDto[];

  @ApiProperty({ type: [LectureOptionDto] })
  lectures!: LectureOptionDto[];

=======
>>>>>>> b3aba5bb7454c60bed62b01cee6c963b9afbc016
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
