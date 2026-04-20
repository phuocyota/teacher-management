import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/common/sql/base.entity';
import { QuestionEntity } from 'src/question/question.entity';
import { ContentTypes } from 'src/common/enum/content-type.enum';

@Entity('answer')
export class AnswerEntity extends BaseEntity {
  // Đánh dấu đáp án đúng
  @Column({ name: 'is_correct', type: 'boolean', nullable: true, default: false })
  isCorrect?: boolean;

  // Thứ tự của đáp án trong câu hỏi
  @Column({ name: 'order_no', type: 'int', nullable: true, default: 0 })
  orderNo?: number;

  // Loại dữ liệu của câu trả lời
  @Column({
    type: 'enum',
    enum: ContentTypes,
    name: 'content_type',
  })
  contentType!: ContentTypes;

  // Nội dung của câu trả lời
  @Column({ type: 'text' })
  content!: string;

  // Metadata mở rộng cho các kiểu câu hỏi đặc biệt
  @Column({ name: 'meta', type: 'jsonb', nullable: true })
  meta?: Record<string, unknown> | null;

  // ID của nội dung tiếp theo nếu có
  @Column({ type: 'uuid', nullable: true })
  nextContent?: string;

  // Mối quan hệ với câu hỏi
  @ManyToOne(() => QuestionEntity, (question) => question.answers, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'questionId' })
  question!: QuestionEntity;

  // ID của câu hỏi mà câu trả lời thuộc về
  @Column({ type: 'uuid' })
  questionId!: string;
}
