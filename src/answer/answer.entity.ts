import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/common/sql/base.entity';
import { QuestionEntity } from 'src/question/question.entity';
import { ContentTypes } from 'src/common/enum/content-type.enum';

@Entity('answer')
export class AnswerEntity extends BaseEntity {
  @Column({
    type: 'enum',
    enum: ContentTypes,
    name: 'content_type',
  })
  contentType!: ContentTypes; // Loại dữ liệu của câu trả lời

  @Column({ type: 'text' })
  content!: string; // Nội dung của câu trả lời

  @ManyToOne(() => QuestionEntity, (question) => question.answers, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'questionId' })
  question!: QuestionEntity; // Mối quan hệ với câu hỏi

  @Column({ type: 'uuid' })
  questionId!: string; // ID của câu hỏi mà câu trả lời thuộc về
}
