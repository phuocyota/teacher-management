import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { ClassEntity } from 'src/class/class.entity';
import { BaseEntity } from 'src/common/sql/base.entity';
import { QuestionEntity } from 'src/question/question.entity';

@Entity('question_bank')
export class QuestionBankEntity extends BaseEntity {
  @Index('idx_question_bank_code', { unique: true })
  @Column({
    name: 'code',
    type: 'varchar',
    length: 50,
    nullable: false,
    unique: true,
  })
  code: string; // Mã ngân hàng câu hỏi

  @Column({ name: 'name', type: 'varchar', length: 255, nullable: false })
  name: string; // Tên ngân hàng câu hỏi

  @Column({ name: 'total_marks', type: 'int', nullable: false })
  totalMarks: number; // Tổng điểm của kỳ thi

  @Column({ name: 'exam_date', type: 'date', nullable: false })
  examDate: string; // Ngày diễn ra kỳ thi

  @Column({ type: 'uuid' })
  classId: string;

  @ManyToOne(() => ClassEntity, (c) => c.questionBanks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'classId' })
  class: ClassEntity;

  @OneToMany(() => QuestionEntity, (question) => question.questionBank)
  questions: QuestionEntity[];

  @Column({ name: 'image', type: 'text', nullable: true })
  image: string; // Hình ảnh liên quan đến ngân hàng câu hỏi
}
