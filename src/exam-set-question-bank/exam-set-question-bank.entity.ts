import { BaseEntity } from 'src/common/sql/base.entity';
import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { ExamSetEntity } from 'src/exam-set/exam-set.entity';
import { QuestionBankEntity } from 'src/question-bank/question-bank.entity';

@Entity('exam_set_question_bank')
export class ExamSetQuestionBankEntity extends BaseEntity {
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
    name: 'question_bank_id',
    type: 'uuid',
    nullable: false,
  })
  questionBankId!: string;

  @ManyToOne(() => QuestionBankEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'question_bank_id' })
  questionBank!: QuestionBankEntity;

  @Column({
    name: 'order',
    type: 'int',
    nullable: false,
  })
  order!: number;
}
