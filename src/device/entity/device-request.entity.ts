import { Column, Entity } from 'typeorm';
import { BaseDeviceEntity } from './base-device.entity';
import { DeviceRequestStatus } from 'src/common/enum/device-request.enum';

@Entity('device_requests')
export class DeviceRequest extends BaseDeviceEntity {
  @Column({ name: 'metadata', type: 'jsonb' })
  metadata?: any;

  @Column({ name: 'status', type: 'enum', enum: DeviceRequestStatus })
  status: DeviceRequestStatus;

  @Column({ name: 'reject_reason', type: 'text' })
  rejectReason?: string;

  @Column({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @Column({ name: 'created_by', type: 'uuid', nullable: false })
  createdBy: string;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy?: string;
}
