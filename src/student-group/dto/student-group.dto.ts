import { ApiProperty } from '@nestjs/swagger';
import { BaseDto } from 'src/common/dto/base.dto';
import { PaginationResponseDto } from 'src/common/dto/pagination.dto';

export class StudentGroupResponseDto extends BaseDto {
  @ApiProperty({
    description: 'Mã nhóm học sinh',
    example: 1,
  })
  code!: number;

  @ApiProperty({
    description: 'Tên nhóm học sinh',
    example: 'Nhóm A1',
  })
  name!: string;

  @ApiProperty({
    description: 'ID của trường học',
    example: '2233abe3-1961-4af5-a482-542f1227d844',
    required: false,
  })
  schoolId?: string;
}

export class StudentGroupListResponseDto extends PaginationResponseDto<StudentGroupResponseDto> {
  @ApiProperty({
    description: 'Danh sách nhóm học sinh',
    type: [StudentGroupResponseDto],
  })
  declare data: StudentGroupResponseDto[];
}
