import { Entity, Column, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../common/sql/base.entity';
import { LectureEntity } from './lecture.entity';
import { Type, Source } from '../enum/lecture-resource.enum';

@Entity('lecture_resource')
export class LectureResourceEntity extends BaseEntity {
  @ManyToOne(() => LectureEntity, (lecture) => lecture.resources, {
    onDelete: 'CASCADE',
  })
  lecture: LectureEntity;

  @Column({
    name: 'type',
    type: 'enum',
    enum: Type,
  })
  type: Type;

  @Column({
    name: 'source',
    type: 'enum',
    enum: Source,
  })
  source: Source;

  @Column({ name: 'url', type: 'text' })
  url: string;
}
