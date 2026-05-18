import { BaseEntity } from 'src/common/sql/base.entity';
import { Column, Entity, OneToMany } from 'typeorm';
import { SchoolSubjectEntity } from './school-subject.entity';
import { StudentGroupSubjectEntity } from './student-group-subject.entity';

@Entity('subject')
export class SubjectEntity extends BaseEntity {
  @Column({
    name: 'code',
    type: 'varchar',
    length: 50,
    nullable: false,
  })
  code!: string;

  @Column({
    name: 'name',
    type: 'varchar',
    length: 255,
    nullable: false,
  })
  name!: string;

  @OneToMany(
    () => SchoolSubjectEntity,
    (schoolSubject) => schoolSubject.subject,
  )
  schoolSubjects!: SchoolSubjectEntity[];

  @OneToMany(
    () => StudentGroupSubjectEntity,
    (studentGroupSubject) => studentGroupSubject.subject,
  )
  studentGroupSubjects!: StudentGroupSubjectEntity[];
}
