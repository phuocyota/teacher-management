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
  name!: string; // Tên bộ đề thi

  @Column({
    name: 'description',
    type: 'text',
    nullable: true,
  })
  description?: string; // Mô tả bộ đề thi

  //count
  @Column({
    name: 'question_bank_count',
    type: 'integer',
    nullable: true,
    default: 0,
  })
  questionBankCount?: number; // Số lượng ngân hàng câu hỏi trong bộ đề thi

  @Column({
    name: 'image',
    type: 'text',
    nullable: true,
  })
  image?: string; // Hình ảnh liên quan đến bộ đề thi

  @Column({
    name: 'class_id',
    type: 'uuid',
    nullable: true,
  })
  classId?: string; // ID của lớp học

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
  status!: ExamSetStatus; // Trạng thái của bộ đề thi
}
