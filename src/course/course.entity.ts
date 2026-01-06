import { BaseEntity } from 'src/common/sql/base.entity';
import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { ClassEntity } from 'src/class/class.entity';

@Entity('course')
export class CourseEntity extends BaseEntity {
  @Column({ name: 'code', type: 'text', nullable: false })
  code!: string;

  @Column({ name: 'name', type: 'text', nullable: false })
  name!: string;

  @Column({ name: 'image', type: 'text', nullable: true })
  image?: string;

  @Column({ name: 'note', type: 'text', nullable: true })
  note?: string;

  @Column({ name: 'class_id', type: 'uuid', nullable: true })
  classId?: string;

  @ManyToOne(() => ClassEntity, (cls) => cls.courses, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'class_id' })
  class?: ClassEntity;
}
