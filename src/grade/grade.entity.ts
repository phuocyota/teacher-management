import { BaseEntity } from 'src/common/sql/base.entity';
import { Column, Entity } from 'typeorm';

@Entity('grade')
export class GradeEntity extends BaseEntity {
  @Column({
    name: 'code',
    type: 'varchar',
    length: 10,
    nullable: false,
  })
  code!: string;

  @Column({
    name: 'name',
    type: 'varchar',
    length: 100,
    nullable: false,
  })
  name!: string;
}
