import { BaseEntity } from 'src/common/sql/base.entity';
import { UserEntity } from 'src/user/user.entity';
import { GroupMemberRole } from 'src/user-group/enum/group-member-role.enum';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  Unique,
} from 'typeorm';
import { StudentGroupEntity } from './student-group.entity';

@Entity('student_group_member')
@Unique(['studentGroupId', 'userId'])
@Index(['userId', 'role'])
export class StudentGroupMemberEntity extends BaseEntity {
  @Column({ name: 'student_group_id', type: 'uuid' })
  studentGroupId!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({
    name: 'role',
    type: 'enum',
    enum: GroupMemberRole,
    default: GroupMemberRole.MEMBER,
  })
  role!: GroupMemberRole;

  @ManyToOne(() => StudentGroupEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_group_id' })
  studentGroup!: StudentGroupEntity;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: UserEntity;
}
