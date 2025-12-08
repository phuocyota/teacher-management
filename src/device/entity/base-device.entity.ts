import { PrimaryGeneratedColumn, Column } from 'typeorm';

export abstract class BaseDeviceEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'device_id', type: 'text', nullable: false })
  deviceId: string;

  @Column({ name: 'product_key', type: 'text', nullable: false })
  productKey: string;
}
