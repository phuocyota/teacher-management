import { Entity, Column, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from 'src/common/sql/base.entity';
import { ZoneEntity } from 'src/zone/zone.entity';

@Entity('school')
export class SchoolEntity extends BaseEntity {
  @Column({ unique: true })
  code!: string;

  @Column()
  name!: string;

  @Column({ name: 'zone_id', type: 'uuid', nullable: true })
  zoneId!: string | null;

  @ManyToOne(() => ZoneEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'zone_id' })
  zone!: ZoneEntity | null;

  @Column({ nullable: true })
  address?: string;
}
