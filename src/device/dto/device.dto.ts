import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, IsObject } from 'class-validator';

export class CreateDeviceRequestDto {
  @ApiProperty({
    description: 'User ID associated with the device request',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  userId!: string;

  @ApiProperty({ description: 'Device ID', example: 'device123' })
  @IsString()
  deviceId!: string;

  @ApiProperty({
    description: 'Product key of the device',
    example: 'productKey123',
  })
  @IsString()
  productKey!: string;

  @ApiProperty({
    description: 'Metadata associated with the device',
    example: { key: 'value' },
  })
  @IsObject()
  metadata?: object;
}

export class RejectDeviceRequestDto {
  @ApiProperty({
    description: 'Reason for rejecting the device request',
    example: 'Invalid device ID',
  })
  @IsString()
  rejectReason?: string;
}
