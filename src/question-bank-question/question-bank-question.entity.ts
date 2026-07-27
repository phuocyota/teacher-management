import { BaseEntity } from 'src/common/sql/base.entity';
import { QuestionBankEntity } from 'src/question-bank/question-bank.entity';
import { QuestionBankSectionEntity } from 'src/question-bank-section/question-bank-section.entity';
import { QuestionEntity } from 'src/question/question.entity';
import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';

@Entity('question_bank_question')
export class QuestionBankQuestionEntity extends BaseEntity {
  @Column({ name: 'question_bank_id', type: 'uuid', nullable: false })
  questionBankId!: string;

  @ManyToOne(() => QuestionBankEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'question_bank_id' })
  questionBank!: QuestionBankEntity;

  @Column({ name: 'question_id', type: 'uuid', nullable: false })
  questionId!: string;

  @ManyToOne(() => QuestionEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'question_id' })
  question!: QuestionEntity;

  @Column({ name: 'section_id', type: 'uuid', nullable: true })
  sectionId?: string | null;

  @ManyToOne(() => QuestionBankSectionEntity, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'section_id' })
  section?: QuestionBankSectionEntity | null;

  @Column({ name: 'order_no', type: 'int', nullable: false })
  orderNo!: number;

  @Column({ name: 'points', type: 'float', nullable: false, default: 1 })
  points!: number;
}
