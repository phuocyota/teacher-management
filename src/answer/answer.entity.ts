import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/common/sql/base.entity';
import { QuestionEntity } from 'src/question/question.entity';
import { ContentTypes } from 'src/common/enum/content-type.enum';

@Entity('answer')
export class AnswerEntity extends BaseEntity {
  @Column({ name: 'is_correct', type: 'boolean', nullable: true, default: false })
  isCorrect?: boolean;

  @Column({ name: 'order_no', type: 'int', nullable: true, default: 0 })
  orderNo?: number;

  @Column({
    type: 'enum',
    enum: ContentTypes,
    name: 'content_type',
  })
  contentType!: ContentTypes; // Loại dữ liệu của câu trả lời

  @Column({ type: 'text' })
  content!: string; // Nội dung của câu trả lời

  //next_content
  @Column({ type: 'uuid', nullable: true })
  nextContent?: string; // ID của nội dung tiếp theo (nếu có)

  @ManyToOne(() => QuestionEntity, (question) => question.answers, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'questionId' })
  question!: QuestionEntity; // Mối quan hệ với câu hỏi

  @Column({ type: 'uuid' })
  questionId!: string; // ID của câu hỏi mà câu trả lời thuộc về
}
