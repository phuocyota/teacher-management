import { BaseEntity } from 'src/common/sql/base.entity';
import { SchoolEntity } from 'src/school/school.entity';
import { Column, Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { SubjectEntity } from './subject.entity';

@Entity('school_subject')
@Unique(['schoolId', 'subjectId'])
export class SchoolSubjectEntity extends BaseEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  schoolId!: string;

  @Column({ name: 'subject_id', type: 'uuid' })
  subjectId!: string;

  @ManyToOne(() => SchoolEntity, (school) => school.schoolSubjects, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'school_id' })
  school!: SchoolEntity;

  @ManyToOne(() => SubjectEntity, (subject) => subject.schoolSubjects, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'subject_id' })
  subject!: SubjectEntity;
}
