import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from 'src/common/sql/base.entity';
import { StudentEntity } from 'src/student/student.entity';
import { QuestionBankEntity } from 'src/question-bank/question-bank.entity';
import { AttemptStatus } from './enum/attempt-status.enum';

@Entity('attempt')
export class AttemptEntity extends BaseEntity {
  @Column({ name: 'student_id', type: 'uuid', nullable: false })
  studentId!: string;

  @ManyToOne(() => StudentEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student!: StudentEntity;

  @Column({ name: 'question_bank_id', type: 'uuid', nullable: false })
  questionBankId!: string;

  @ManyToOne(() => QuestionBankEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'question_bank_id' })
  questionBank!: QuestionBankEntity;

  @Column({
    name: 'status',
    type: 'enum',
    enum: AttemptStatus,
    nullable: false,
    default: AttemptStatus.DOING,
  })
  status!: AttemptStatus;

  @Column({ name: 'started_at', type: 'timestamp', nullable: false })
  startedAt!: Date;

  @Column({ name: 'submitted_at', type: 'timestamp', nullable: true })
  submittedAt?: Date;

  @Column({ name: 'score', type: 'float', nullable: true })
  score?: number;
}
