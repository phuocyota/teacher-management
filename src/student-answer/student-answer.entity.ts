import { BaseEntity } from 'src/common/sql/base.entity';
import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { AttemptEntity } from 'src/attempt/attempt.entity';
import { QuestionEntity } from 'src/question/question.entity';
import { AnswerEntity } from 'src/answer/answer.entity';

@Entity('student_answer')
export class StudentAnswerEntity extends BaseEntity {
  @Column({ name: 'attempt_id', type: 'uuid', nullable: false })
  attemptId!: string;

  @ManyToOne(() => AttemptEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'attempt_id' })
  attempt!: AttemptEntity;

  @Column({ name: 'question_id', type: 'uuid', nullable: false })
  questionId!: string;

  @ManyToOne(() => QuestionEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'question_id' })
  question!: QuestionEntity;

  @Column({ name: 'answer_id', type: 'uuid', nullable: true })
  answerId?: string;

  @ManyToOne(() => AnswerEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'answer_id' })
  answer?: AnswerEntity;

  @Column({ name: 'description', type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'text_value', type: 'text', nullable: true })
  textValue?: string;

  @Column({ name: 'is_correct', type: 'boolean', nullable: true })
  isCorrect?: boolean;

  @Column({ name: 'points_earned', type: 'float', nullable: true })
  pointsEarned?: number;

  @Column({ name: 'selected_answer_ids', type: 'jsonb', nullable: true })
  selectedAnswerIds?: string[];

  @Column({ name: 'time_spent_sec', type: 'int', nullable: true })
  timeSpentSec?: number;
}
