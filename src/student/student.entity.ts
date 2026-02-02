//student entity have student group id, user id, code
import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/common/sql/base.entity';
import { StudentGroupEntity } from 'src/student-group/student-group.entity';

@Entity('student')
export class StudentEntity extends BaseEntity {
  @Column({ name: 'user_id', type: 'uuid', nullable: false })
  userId: string; // ID của người dùng (học sinh)

  @Column({ name: 'student_group_id', type: 'uuid', nullable: false })
  studentGroupId: string; // ID của nhóm học sinh

  @Column({ name: 'code', type: 'varchar', length: 50, nullable: false })
  code: string; // Mã học sinh

  @ManyToOne(() => StudentGroupEntity, (studentGroup) => studentGroup.students)
  @JoinColumn({ name: 'student_group_id' })
  studentGroup: StudentGroupEntity; // Nhóm học sinh mà học sinh thuộc về
}
