import { BaseEntity } from 'src/common/sql/base.entity';
import { StudentGroupEntity } from 'src/student-group/student-group.entity';
import { Column, Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { SubjectEntity } from './subject.entity';

@Entity('student_group_subject')
@Unique(['studentGroupId', 'subjectId'])
export class StudentGroupSubjectEntity extends BaseEntity {
  @Column({ name: 'student_group_id', type: 'uuid' })
  studentGroupId!: string;

  @Column({ name: 'subject_id', type: 'uuid' })
  subjectId!: string;

  @ManyToOne(
    () => StudentGroupEntity,
    (studentGroup) => studentGroup.studentGroupSubjects,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'student_group_id' })
  studentGroup!: StudentGroupEntity;

  @ManyToOne(() => SubjectEntity, (subject) => subject.studentGroupSubjects, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'subject_id' })
  subject!: SubjectEntity;
}
