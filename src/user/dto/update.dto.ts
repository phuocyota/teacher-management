import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Status } from '../enum/status.enum.js';
import { CreateUserDto } from './create.dto.js';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @ApiPropertyOptional({
    example: 'ACTIVE',
    description: 'Trạng thái của người dùng',
    enum: Status,
  })
  @IsOptional()
  @IsEnum(Status, { message: 'Trạng thái không hợp lệ' })
  status?: Status;

  @ApiPropertyOptional({
    example: false,
    description: 'Vô hiệu hóa tài khoản',
  })
  @IsOptional()
  @IsBoolean()
  isDisabled?: boolean;
}
