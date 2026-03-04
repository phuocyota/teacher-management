import { ApiProperty } from '@nestjs/swagger';
import { BaseDto } from 'src/common/dto/base.dto';
import { PaginationResponseDto } from 'src/common/dto/pagination.dto';

export class SubjectResponseDto extends BaseDto {
  @ApiProperty({
    description: 'Ma mon hoc (code)',
    example: 'SUB-001',
  })
  code!: string;

  @ApiProperty({
    description: 'Ten mon hoc',
    example: 'Toan',
  })
  name!: string;
}

export class SubjectListResponseDto extends PaginationResponseDto<SubjectResponseDto> {
  @ApiProperty({
    description: 'Danh sach mon hoc',
    type: [SubjectResponseDto],
  })
  declare data: SubjectResponseDto[];
}
