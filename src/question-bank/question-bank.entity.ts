import { Entity, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { ClassEntity } from '../class/class.entity';
import { BaseEntity } from 'src/common/sql/base.entity';
import { QuestionEntity } from 'src/question/question.entity';

@Entity('question_bank')
export class QuestionBankEntity extends BaseEntity {
  @Column({ name: 'total_marks', type: 'int', nullable: false })
  totalMarks: number; // Tổng điểm của kỳ thi

  @Column({ name: 'exam_date', type: 'date', nullable: false })
  examDate: string; // Ngày diễn ra kỳ thi

  @Column()
  classId: number;

  @ManyToOne(() => ClassEntity, (classEntity) => classEntity.questionBanks)
  @JoinColumn({ name: 'classId' })
  class: ClassEntity;

  @OneToMany(() => QuestionEntity, (question) => question.questionBank)
  questions: QuestionEntity[];
}
