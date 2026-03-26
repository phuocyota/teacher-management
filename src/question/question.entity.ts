import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity } from 'src/common/sql/base.entity';
import { ContentTypes } from 'src/common/enum/content-type.enum';
import { AnswerEntity } from 'src/answer/answer.entity';
import { QuestionType } from './enum/question-type.enum';

@Entity('question')
export class QuestionEntity extends BaseEntity {
  @Column({
    name: 'question_type',
    type: 'enum',
    enum: QuestionType,
    default: QuestionType.SINGLE_CHOICE,
    nullable: false,
  })
  type!: QuestionType;

  @Column({
    name: 'content_type',
    type: 'enum',
    enum: ContentTypes,
    nullable: false,
  })
  contentType: ContentTypes;

  @Column({ name: 'content', type: 'text', nullable: false })
  content: string;

  @Column({ name: 'next_content', type: 'uuid', nullable: true })
  nextContent?: string;

  @Column({ name: 'is_root', type: 'boolean', default: true })
  isRoot!: boolean;

  @OneToMany(() => AnswerEntity, (answer) => answer.question)
  answers: AnswerEntity[];
}
