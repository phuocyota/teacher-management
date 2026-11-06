//student entity have student group id, user id, code
import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from 'src/common/sql/base.entity';
import { StudentGroupEntity } from 'src/student-group/student-group.entity';
import { SchoolEntity } from 'src/school/school.entity';

@Entity('student')
@Index('idx_student_code', ['code'])
export class StudentEntity extends BaseEntity {
  @Column({ name: 'full_name', type: 'varchar', length: 255, nullable: true })
  fullName!: string | null;

  @Column({ type: 'varchar', length: 2048, nullable: true })
  image!: string | null;

  @Column({ type: 'varchar', length: 24, nullable: true })
  phone!: string | null;

  @Column({ name: 'student_group_id', type: 'uuid', nullable: true })
  studentGroupId!: string | null; // ID của nhóm học sinh

  @Column({ name: 'school_id', type: 'uuid', nullable: true })
  schoolId!: string | null; // ID của trường học ngoài hệ thống

  @Column({ name: 'code', type: 'varchar', length: 50, nullable: false })
  code!: string; // Mã học sinh

  @ManyToOne(
    () => StudentGroupEntity,
    (studentGroup) => studentGroup.students,
    {
      nullable: true,
    },
  )
  @JoinColumn({ name: 'student_group_id' })
  studentGroup!: StudentGroupEntity | null; // Nhóm học sinh mà học sinh thuộc về

  @ManyToOne(() => SchoolEntity, { nullable: true })
  @JoinColumn({ name: 'school_id' })
  school!: SchoolEntity | null; // Trường học ngoài hệ thống
}
