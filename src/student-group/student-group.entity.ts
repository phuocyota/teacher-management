import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
  OneToMany,
} from 'typeorm';
import { BaseEntity } from 'src/common/sql/base.entity';
import { SchoolEntity } from 'src/school/school.entity';
import { StudentEntity } from 'src/student/student.entity';
import { GroupMemberRole } from 'src/user-group/enum/group-member-role.enum';

@Entity('student_group')
@Unique(['code', 'schoolId'])
export class StudentGroupEntity extends BaseEntity {
  @Column()
  code: number;

  @Column()
  name: string;

  @Column({
    name: 'role',
    type: 'enum',
    enum: GroupMemberRole,
    default: GroupMemberRole.MEMBER,
  })
  role: GroupMemberRole;

  @ManyToOne(() => SchoolEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'schoolId' })
  school!: SchoolEntity; // Mối quan hệ với trường học

  @Column({ type: 'uuid' })
  schoolId!: string; // ID của trường học mà nhóm sinh viên thuộc về

  // Thêm mối quan hệ với StudentEntity nếu cần
  @OneToMany(() => StudentEntity, (student) => student.studentGroup)
  students: StudentEntity[];
}
