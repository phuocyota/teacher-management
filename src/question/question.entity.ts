import { Entity, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { BaseEntity } from 'src/common/sql/base.entity';
import { QuestionBankEntity } from 'src/question-bank/question-bank.entity';
import { ContentTypes } from 'src/common/enum/content-type.enum';
import { AnswerEntity } from 'src/answer/answer.entity';

@Entity('question')
export class QuestionEntity extends BaseEntity {
  @Column({
    name: 'content_type',
    type: 'enum',
    enum: ContentTypes,
    nullable: false,
  })
  contentType: ContentTypes; // Loại dữ liệu của câu hỏi

  @Column({ name: 'content', type: 'text', nullable: false })
  content: string; // Nội dung câu hỏi

  @Column()
  questionBankId: string;

  @ManyToOne(() => QuestionBankEntity, (questionBank) => questionBank.questions)
  @JoinColumn({ name: 'questionBankId' })
  questionBank: QuestionBankEntity; // Ngân hàng câu hỏi mà câu hỏi thuộc về

  @OneToMany(() => AnswerEntity, (answer) => answer.question)
  answers: AnswerEntity[]; // Các câu trả lời liên quan đến câu hỏi
}
