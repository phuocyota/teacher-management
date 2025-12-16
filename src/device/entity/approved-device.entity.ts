import { Entity, Column, CreateDateColumn } from 'typeorm';
import { BaseDeviceEntity } from './base-device.entity';

@Entity({ name: 'approved_devices' })
export class ApprovedDeviceEntity extends BaseDeviceEntity {
  @Column({ name: 'user_id', type: 'uuid', nullable: false })
  userId: string;

  @CreateDateColumn({ name: 'approved_at', type: 'timestamp' })
  approvedAt: Date;

  @Column({ name: 'approved_by', type: 'uuid' })
  approvedBy?: string;
}
