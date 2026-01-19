import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationRequestDto } from 'src/common/dto/pagination.dto';

export class GetListClassRequestDto extends PaginationRequestDto {
  @ApiPropertyOptional({
    type: 'string',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description: 'ID người dùng',
  })
  @IsOptional()
  @IsString()
  userId?: string;
}
