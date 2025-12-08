import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../common/sql/base.entity';

@Entity()
export class Teacher extends BaseEntity {
  @Column()
  name: string;

  @Column()
  email: string;

  @Column({ nullable: false, unique: true, name: 'device_id' })
  deviceId!: string;
}
