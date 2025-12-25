import { BaseEntity } from 'src/common/sql/base.entity';
import { Entity, Column } from 'typeorm';

@Entity('course')
export class CourseEntity extends BaseEntity {
  @Column({ name: 'code', type: 'text', unique: true, nullable: false })
  code!: string;

  @Column({ name: 'name', type: 'text', nullable: false })
  name!: string;

  @Column({ name: 'image', type: 'text', nullable: true })
  image?: string;

  @Column({ name: 'note', type: 'text', nullable: true })
  note?: string;
}
