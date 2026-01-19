import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID } from 'class-validator';
import { PaginationRequestDto } from 'src/common/dto/pagination.dto';

export class CreateLectureUserDto {
  @ApiProperty({
    description: 'ID của bài giảng',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsUUID()
  lectureId: string;

  @ApiProperty({
    description: 'Danh sách ID người dùng',
    example: ['b1c2d3e4-f5g6-7890-abcd-ef1234567890'],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  userIds: string[];
}

export class UpdateLectureUserDto {
  @ApiProperty({
    description: 'ID của bài giảng',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsUUID()
  lectureId: string;

  @ApiProperty({
    description: 'Danh sách ID người dùng',
    example: ['b1c2d3e4-f5g6-7890-abcd-ef1234567890'],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  userIds: string[];
}

export class GetListLectureUserDto extends PaginationRequestDto {
  @ApiProperty({
    description: 'ID của bài giảng',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsUUID()
  lectureId: string;
}

export class BulkCreateLectureUserDto {
  @ApiProperty({
    description: 'Danh sách ID bài giảng',
    example: [
      'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      'b2c3d4e5-f6g7-8901-bcde-fg2345678901',
    ],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  lectureIds: string[];

  @ApiProperty({
    description: 'Danh sách ID người dùng',
    example: [
      'c3d4e5f6-g7h8-9012-cdef-gh3456789012',
      'd4e5f6g7-h8i9-0123-defg-hi4567890123',
    ],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  userIds: string[];
}
