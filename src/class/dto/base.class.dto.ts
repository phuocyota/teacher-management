import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BaseDto } from 'src/common/dto/base.dto';

export class ClassDto extends BaseDto {
  @ApiProperty({ description: 'Tên lớp học' })
  name: string;

  @ApiPropertyOptional({ description: 'Mô tả lớp học' })
  description?: string;
}
