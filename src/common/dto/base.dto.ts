import { ApiProperty } from '@nestjs/swagger';

export class BaseDto {
  id: string;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export class MaxCodeResponseDto {
  @ApiProperty({
    description: 'Mã lớn nhất hiện tại (dạng số)',
    example: 10,
  })
  maxCode: number;
}
