import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../common/sql/base.entity';

@Entity()
export class LectureEntity extends BaseEntity {
  @Column()
  title: string;

  @Column({ nullable: true })
  description: string;
}
