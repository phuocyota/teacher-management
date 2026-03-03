import { ApiProperty } from '@nestjs/swagger';
import { BaseDto } from 'src/common/dto/base.dto';
import { PaginationResponseDto } from 'src/common/dto/pagination.dto';

export class GradeResponseDto extends BaseDto {
  @ApiProperty({
    description: 'Ma Khối (code)',
    example: 'GR-10',
  })
  code!: string;

  @ApiProperty({
    description: 'Ten Khối',
    example: 'Khối 10',
  })
  name!: string;
}

export class GradeListResponseDto extends PaginationResponseDto<GradeResponseDto> {
  @ApiProperty({
    description: 'Danh sach Khối',
    type: [GradeResponseDto],
  })
  declare data: GradeResponseDto[];
}
