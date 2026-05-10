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

export class ZoneDetailInfoDto {
  @ApiProperty({
    description: 'ID',
    example: '2233abe3-1961-4af5-a482-542f1227d844',
  })
  id!: string;

  @ApiProperty({
    description: 'Ten',
    example: 'Khu vuc 1',
  })
  name!: string;

  @ApiProperty({
    description: 'Ma',
    example: 'ZONE-001',
  })
  code!: string | number;
}

export class ZoneDetailStudentGroupDto extends ZoneDetailInfoDto {
}

export class ZoneDetailSchoolDto extends ZoneDetailInfoDto {
  @ApiProperty({
    description: 'Danh sach nhom hoc sinh trong truong',
    type: [ZoneDetailStudentGroupDto],
  })
  studentGroups!: ZoneDetailStudentGroupDto[];
}

export class ZoneDetailResponseDto {
  @ApiProperty({
    description: 'Thong tin khu vuc',
    type: ZoneDetailInfoDto,
  })
  zone!: ZoneDetailInfoDto;

  @ApiProperty({
    description: 'Danh sach truong trong khu vuc',
    type: [ZoneDetailSchoolDto],
  })
  schools!: ZoneDetailSchoolDto[];
}

export class ZoneDetailListResponseDto extends PaginationResponseDto<ZoneDetailResponseDto> {
  @ApiProperty({
    description: 'Danh sach khu vuc kem truong, nhom hoc sinh va thanh vien',
    type: [ZoneDetailResponseDto],
  })
  declare data: ZoneDetailResponseDto[];
}
