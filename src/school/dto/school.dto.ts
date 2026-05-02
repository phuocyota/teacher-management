import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

  @ApiPropertyOptional({
    description: 'ID khu vuc',
    example: '2233abe3-1961-4af5-a482-542f1227d844',
    nullable: true,
  })
  zoneId!: string | null;

  @ApiPropertyOptional({
    description: 'Ten khu vuc',
    example: 'Khu vuc 1',
    nullable: true,
  })
  zoneName?: string | null;

  @ApiPropertyOptional({
    description: 'ID user hiệu trưởng của trường',
    example: '3233abe3-1961-4af5-a482-542f1227d844',
    nullable: true,
  })
  principalUserId!: string | null;

  @ApiPropertyOptional({
    description: 'Tên hiệu trưởng',
    example: 'Nguyễn Văn A',
    nullable: true,
  })
  principalUserName?: string | null;

  @ApiPropertyOptional({
    description: 'Địa chỉ trường học',
    example: '123 Đường ABC, Quận 1, TP.HCM',
  })
  address?: string;
}

export class SchoolListResponseDto extends PaginationResponseDto<SchoolResponseDto> {
  @ApiProperty({
    description: 'Danh sách trường học',
    type: [SchoolResponseDto],
  })
  declare data: SchoolResponseDto[];
}
