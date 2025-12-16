import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, IsObject } from 'class-validator';

export class DeviceRequestDto {
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

export class ApprovedDeviceDto extends DeviceRequestDto {
  @ApiProperty({
    description: 'Date and time when the device was approved',
    example: '2024-01-01T12:00:00Z',
  })
  @IsString()
  approvedAt!: string;
}

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
    description: 'Lý do từ chối yêu cầu thiết bị',
    example: 'ID thiết bị không hợp lệ',
  })
  @IsString()
  rejectReason?: string;
}
