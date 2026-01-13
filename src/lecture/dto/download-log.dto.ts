import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsString, IsNotEmpty } from 'class-validator';
import { PaginationRequestDto } from 'src/common/dto/pagingation.dto';

export class CreateDownloadLogDto {
  @ApiProperty({
    description: 'ID của bài giảng',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsUUID()
  lectureId: string;

  @ApiProperty({
    description: 'Đường dẫn file đã tải',
    example: '/uploads/lecture/file.pdf',
  })
  @IsString()
  @IsNotEmpty()
  path: string;

  @ApiProperty({
    description: 'Loại file',
    example: 'pdf',
  })
  @IsString()
  @IsNotEmpty()
  type: string;
}

export class GetDownloadLogQueryDto extends PaginationRequestDto {
  @ApiProperty({
    description: 'ID của bài giảng',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    required: false,
  })
  @IsUUID()
  lectureId?: string;

  @ApiProperty({
    description: 'ID người dùng',
    example: 'b1c2d3e4-f5g6-7890-abcd-ef1234567890',
    required: false,
  })
  @IsUUID()
  userId?: string;

  @ApiProperty({
    description: 'ID của khóa học',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    required: false,
  })
  @IsUUID()
  courseId?: string;
}
