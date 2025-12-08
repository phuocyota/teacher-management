import { Entity, Column, CreateDateColumn, Unique } from 'typeorm';
import { BaseDeviceEntity } from './base-device.entity';

@Entity({ name: 'approved_devices' })
@Unique(['user_id', 'device_id'])
export class ApprovedDevice extends BaseDeviceEntity {
  @Column({ name: 'user_id', type: 'uuid', nullable: false })
  userId: string;

  @CreateDateColumn({ name: 'approved_at', type: 'timestamp' })
  approvedAt: Date;

  @Column({ name: 'approved_by', type: 'uuid' })
  approvedBy?: string;
}
