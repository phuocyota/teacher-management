import { ApiProperty } from '@nestjs/swagger';
import { BaseDto } from 'src/common/dto/base.dto';
import { PaginationResponseDto } from 'src/common/dto/pagination.dto';
import { ExamSetStatus } from '../enum/exam-set-status.enum';

export class ExamSetResponseDto extends BaseDto {
  @ApiProperty({
    description: 'Ten bo de thi',
    example: 'Bo de thi hoc ky 1',
  })
  name!: string;

  @ApiProperty({
    description: 'Mo ta bo de thi',
    example: 'Bo de danh cho lop 10A1 mon Toan',
    required: false,
  })
  description?: string;

  @ApiProperty({
    description: 'ID lop hoc',
    example: '2233abe3-1961-4af5-a482-542f1227d844',
    required: false,
  })
  classId?: string;

  @ApiProperty({
    description: 'Trang thai bo de',
    example: ExamSetStatus.DRAFT,
    enum: ExamSetStatus,
  })
  status!: ExamSetStatus;
}

export class ExamSetListResponseDto extends PaginationResponseDto<ExamSetResponseDto> {
  @ApiProperty({
    description: 'Danh sach bo de thi',
    type: [ExamSetResponseDto],
  })
  declare data: ExamSetResponseDto[];
}
