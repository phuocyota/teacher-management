//viết dto cho lecture context trong đó bao gồm mảng userIds, lectureId
import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID } from 'class-validator';
import { PaginationRequestDto } from 'src/common/dto/pagingation.dto';

export class CreateLectureContextDto {
  //thêm API doc swagger cho các field bên dưới
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

export class UpdateLectureContextDto {
  //optional lectureId
  @ApiProperty({
    description: 'ID của bài giảng',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsUUID()
  lectureId?: string;

  //optional userIds
  @ApiProperty({
    description: 'Danh sách ID người dùng',
    example: ['b1c2d3e4-f5g6-7890-abcd-ef1234567890'],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  userIds?: string[];
}

export class GetListLectureContextDto extends PaginationRequestDto {
  @ApiProperty({
    description: 'ID của bài giảng',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsUUID()
  lectureId: string;
}
