import { ApiProperty } from '@nestjs/swagger';
import { BaseDto } from 'src/common/dto/base.dto';
import { PaginationResponseDto } from 'src/common/dto/pagination.dto';

export class SchoolResponseDto extends BaseDto {
  @ApiProperty({
    description: 'Mã trường học',
    example: 'SCH001',
  })
  code!: string;
  @ApiProperty({
    description: 'Tên trường học',
    example: 'Trường THPT Nguyễn Huệ',
  })
  name!: string;
  @ApiProperty({
    description: 'Địa chỉ trường học',
    example: '123 Đường ABC, Quận 1, TP.HCM',
  })
  address!: string;
}

export class SchoolListResponseDto extends PaginationResponseDto<SchoolResponseDto> {
  @ApiProperty({
    description: 'Danh sách trường học',
    type: [SchoolResponseDto],
  })
  declare data: SchoolResponseDto[];
}
