import { BaseEntity } from 'src/common/sql/base.entity';
import { Entity, Column } from 'typeorm';

@Entity('licenses')
export class LicenseEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 100 })
  key: string;

  @Column({ type: 'date' })
  activationDate!: Date;

  @Column({ type: 'date' })
  expirationDate: Date;

  @Column({ type: 'uuid' })
  userId: string;
}
