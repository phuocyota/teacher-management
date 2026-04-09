import { BaseEntity } from 'src/common/sql/base.entity';
import { ClassEntity } from 'src/class/class.entity';
import { ExamSetEntity } from 'src/exam-set/exam-set.entity';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

@Entity('exam_set_class')
@Index('idx_exam_set_class_unique', ['examSetId', 'classId'], { unique: true })
export class ExamSetClassEntity extends BaseEntity {
  @Column({
    name: 'exam_set_id',
    type: 'uuid',
    nullable: false,
  })
  examSetId!: string;

  @ManyToOne(() => ExamSetEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'exam_set_id' })
  examSet!: ExamSetEntity;

  @Column({
    name: 'class_id',
    type: 'uuid',
    nullable: false,
  })
  classId!: string;

  @ManyToOne(() => ClassEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'class_id' })
  class!: ClassEntity;
}
