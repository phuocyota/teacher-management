import { BaseEntity } from 'src/common/sql/base.entity';
import { Column, Entity } from 'typeorm';

@Entity('subject')
export class SubjectEntity extends BaseEntity {
  @Column({
    name: 'code',
    type: 'varchar',
    length: 50,
    nullable: false,
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
