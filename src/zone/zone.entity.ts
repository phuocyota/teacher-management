import { BaseEntity } from 'src/common/sql/base.entity';
import { Column, Entity } from 'typeorm';

@Entity('zone')
export class ZoneEntity extends BaseEntity {
  @Column({
    name: 'code',
    type: 'varchar',
    length: 50,
    nullable: false,
    unique: true,
  })
  code!: string;

  @Column({
    name: 'name',
    type: 'varchar',
    length: 255,
    nullable: false,
  })
  name!: string;
}
