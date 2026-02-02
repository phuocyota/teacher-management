import { Entity, Column } from 'typeorm';
import { BaseEntity } from 'src/common/sql/base.entity';

@Entity('school')
export class SchoolEntity extends BaseEntity {
  @Column({ unique: true })
  code: string;

  @Column()
  name: string;

  @Column()
  address: string;
}
