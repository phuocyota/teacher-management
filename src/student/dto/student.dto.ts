import { ApiProperty } from '@nestjs/swagger';
import { BaseDto } from 'src/common/dto/base.dto';
import { PaginationResponseDto } from 'src/common/dto/pagination.dto';

export class StudentResponseDto extends BaseDto {
  @ApiProperty({
    description: 'ID của người dùng (học sinh)',
    example: '2233abe3-1961-4af5-a482-542f1227d844',
  })
  userId!: string;

  @ApiProperty({
    description: 'ID của nhóm học sinh',
    example: '3344abe3-1961-4af5-a482-542f1227d855',
  })
  studentGroupId!: string;

  @ApiProperty({
    description: 'Mã học sinh',
    example: 'HS001',
  })
  code!: string;
}

export class StudentListResponseDto extends PaginationResponseDto<StudentResponseDto> {
  @ApiProperty({
    description: 'Danh sách học sinh',
    type: [StudentResponseDto],
  })
  declare data: StudentResponseDto[];
}
