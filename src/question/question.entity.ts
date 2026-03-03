import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity } from 'src/common/sql/base.entity';
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

  //next_content
  @Column({ name: 'next_content', type: 'uuid', nullable: true })
  nextContent?: string; // Nội dung tiếp theo sau câu hỏi (nếu câu hỏi đó vừa hình vừa chữ xen kẽ nhau)

  @OneToMany(() => AnswerEntity, (answer) => answer.question)
  answers: AnswerEntity[]; // Các câu trả lời liên quan đến câu hỏi
}
