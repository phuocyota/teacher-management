import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BaseDto } from 'src/common/dto/base.dto';
import { PaginationResponseDto } from 'src/common/dto/pagination.dto';

export class StudentResponseDto extends BaseDto {
  @ApiPropertyOptional({
    description: 'ID cua nhom hoc sinh',
    example: '3344abe3-1961-4af5-a482-542f1227d855',
    nullable: true,
  })
  studentGroupId!: string | null;

  @ApiPropertyOptional({
    description: 'ID cua truong hoc',
    example: '2233abe3-1961-4af5-a482-542f1227d844',
    nullable: true,
  })
  schoolId!: string | null;

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
