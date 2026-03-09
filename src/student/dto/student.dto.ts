import { ApiProperty } from '@nestjs/swagger';
import { BaseDto } from 'src/common/dto/base.dto';
import { PaginationResponseDto } from 'src/common/dto/pagination.dto';

export class StudentResponseDto extends BaseDto {
  @ApiProperty({
    description: 'ID cua nhom hoc sinh',
    example: '3344abe3-1961-4af5-a482-542f1227d855',
  })
  studentGroupId!: string;

  @ApiProperty({
    description: 'Ma hoc sinh',
    example: 'HS001',
  })
  code!: string;
}

export class StudentListResponseDto extends PaginationResponseDto<StudentResponseDto> {
  @ApiProperty({
    description: 'Danh sach hoc sinh',
    type: [StudentResponseDto],
  })
  declare data: StudentResponseDto[];
}
