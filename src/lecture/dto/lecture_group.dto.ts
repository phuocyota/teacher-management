import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';

export class BulkCreateLectureGroupDto {
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
    description: 'Danh sách ID nhóm',
    example: [
      'c3d4e5f6-g7h8-9012-cdef-gh3456789012',
      'd4e5f6g7-h8i9-0123-defg-hi4567890123',
    ],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  groupIds: string[];
}

export class BulkExcludeLectureGroupDto {
  @ApiProperty({
    description: 'Danh sách ID nhóm cần gỡ bài giảng',
    example: [
      'c3d4e5f6-a7b8-4012-cdef-ab3456789012',
      'd4e5f6a7-b8c9-4123-defa-bc4567890123',
    ],
  })
  @IsArray({ message: 'groupIds phải là một danh sách' })
  @ArrayNotEmpty({ message: 'groupIds không được để trống' })
  @IsUUID('4', { each: true, message: 'Mỗi groupId phải là UUID hợp lệ' })
  groupIds: string[];

  @ApiProperty({
    description: 'Danh sách ID bài giảng cần gỡ khỏi nhóm',
    example: [
      'a1b2c3d4-e5f6-4890-abcd-ef1234567890',
      'b2c3d4e5-f6a7-4901-bcde-fa2345678901',
    ],
  })
  @IsArray({ message: 'lectureIds phải là một danh sách' })
  @ArrayNotEmpty({ message: 'lectureIds không được để trống' })
  @IsUUID('4', { each: true, message: 'Mỗi lectureId phải là UUID hợp lệ' })
  lectureIds: string[];
}
