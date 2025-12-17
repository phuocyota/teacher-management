import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../common/sql/base.entity';

@Entity('teacher')
export class TeacherEntity extends BaseEntity {
  @Column({ name: 'name', type: 'varchar' })
  name: string;

  @Column({ name: 'email', type: 'text' })
  email: string;

  @Column({ nullable: false, unique: true, name: 'device_id' })
  deviceId!: string;
}
