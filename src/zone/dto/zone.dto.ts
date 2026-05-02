import { ApiProperty } from '@nestjs/swagger';
import { BaseDto } from 'src/common/dto/base.dto';
import { PaginationResponseDto } from 'src/common/dto/pagination.dto';

export class ZoneResponseDto extends BaseDto {
  @ApiProperty({
    description: 'Ma khu vuc',
    example: 'ZONE-001',
  })
  code!: string;

  @ApiProperty({
    description: 'Ten khu vuc',
    example: 'Khu vuc 1',
  })
  name!: string;
}

export class ZoneListResponseDto extends PaginationResponseDto<ZoneResponseDto> {
  @ApiProperty({
    description: 'Danh sach khu vuc',
    type: [ZoneResponseDto],
  })
  declare data: ZoneResponseDto[];
}
