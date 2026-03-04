import { BaseEntity } from 'src/common/sql/base.entity';
import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { ExamSetStatus } from './enum/exam-set-status.enum';
import { ClassEntity } from 'src/class/class.entity';

@Entity('exam_set')
export class ExamSetEntity extends BaseEntity {
  @Column({
    name: 'name',
    type: 'text',
    nullable: false,
  })
  name!: string;

  @Column({
    name: 'description',
    type: 'text',
    nullable: true,
  })
  description?: string;

  @Column({
    name: 'class_id',
    type: 'uuid',
    nullable: true,
  })
  classId?: string;

  @ManyToOne(() => ClassEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'class_id' })
  class?: ClassEntity;

  @Column({
    name: 'status',
    type: 'enum',
    enum: ExamSetStatus,
    nullable: false,
    default: ExamSetStatus.DRAFT,
  })
  status!: ExamSetStatus;
}
