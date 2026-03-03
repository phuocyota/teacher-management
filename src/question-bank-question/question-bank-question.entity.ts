import { BaseEntity } from 'src/common/sql/base.entity';
import { Column, Entity } from 'typeorm';

@Entity('question_bank_question')
export class QuestionBankQuestionEntity extends BaseEntity {
  @Column({ name: 'question_bank_id', type: 'uuid', nullable: false })
  questionBankId!: string;

  @Column({ name: 'question_id', type: 'uuid', nullable: false })
  questionId!: string;

  @Column({ name: 'order_no', type: 'int', nullable: false })
  orderNo!: number;

  @Column({ name: 'points', type: 'float', nullable: false, default: 0 })
  points!: number;
}
