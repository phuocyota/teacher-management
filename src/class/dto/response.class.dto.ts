import { ApiProperty } from '@nestjs/swagger';
import { PaginationResponseDto } from 'src/common/dto/pagination.dto';
import { ClassDto } from './base.class.dto';

export class ClassResponseDto extends ClassDto {}

export class GetListClassResponseDto extends PaginationResponseDto<ClassResponseDto> {
  @ApiProperty({ type: [ClassResponseDto], description: 'Danh sách lớp học' })
  items: ClassResponseDto[];
}
