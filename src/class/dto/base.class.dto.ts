import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BaseDto } from 'src/common/dto/base.dto';

export class ClassDto extends BaseDto {
  @ApiProperty({ description: 'Ma lop hoc' })
  code: string;

  @ApiProperty({ description: 'Ten lop hoc' })
  name: string;

  @ApiProperty({ description: 'So thu tu lop hoc' })
  orderNumber: number;

  @ApiProperty({ description: 'Loai hien thi lop hoc' })
  displayType: string;

  @ApiPropertyOptional({ description: 'Anh hien tai cua lop hoc' })
  currentImage?: string;

  @ApiPropertyOptional({ description: 'Ghi chu ve lop hoc' })
  note?: string;

  @ApiPropertyOptional({ description: 'ID khoi' })
  gradeId?: string;

  @ApiPropertyOptional({ description: 'ID mon hoc' })
  subjectId?: string;

  @ApiPropertyOptional({ description: 'Mo ta lop hoc' })
  description?: string;
}
