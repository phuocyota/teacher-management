import { BaseEntity } from 'src/common/sql/base.entity';
import { QuestionBankEntity } from 'src/question-bank/question-bank.entity';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

@Entity('question_bank_section')
@Index('idx_question_bank_section_bank_order', ['questionBankId', 'orderNo'], {
  unique: true,
})
export class QuestionBankSectionEntity extends BaseEntity {
  @Column({ name: 'question_bank_id', type: 'uuid', nullable: false })
  questionBankId!: string;

  @ManyToOne(() => QuestionBankEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'question_bank_id' })
  questionBank!: QuestionBankEntity;

  @Column({ name: 'title', type: 'varchar', length: 255, nullable: false })
  title!: string;

  @Column({ name: 'instruction', type: 'text', nullable: true })
  instruction?: string | null;

  @Column({ name: 'order_no', type: 'int', nullable: false })
  orderNo!: number;

  @Column({ name: 'meta', type: 'jsonb', nullable: true })
  meta?: Record<string, unknown> | null;
}
