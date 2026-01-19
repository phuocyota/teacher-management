import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  PrimaryColumn,
  Index,
} from 'typeorm';
import { GroupEntity } from 'src/group/entity/group.entity';
import { UserEntity } from 'src/user/user.entity';
import { GroupMemberRole } from 'src/user-group/enum/group-member-role.enum';
import { BaseEntity } from 'src/common/sql/base.entity';

/**
 * Entity cho bảng trung gian giữa User và Group
 * Lưu trữ vai trò của user trong group
 */
@Entity('user_group')
@Index(['groupId', 'userId'], { unique: true })
export class UserGroupEntity extends BaseEntity {
  @PrimaryColumn({ name: 'group_id', type: 'uuid' })
  groupId: string;

  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({
    name: 'role',
    type: 'enum',
    enum: GroupMemberRole,
    default: GroupMemberRole.MEMBER,
  })
  role: GroupMemberRole;

  // ===== Relations =====
  @ManyToOne(() => GroupEntity, (group: GroupEntity) => group.members, {
    onDelete: 'CASCADE',
    eager: false,
  })
  @JoinColumn({ name: 'group_id' })
  group: GroupEntity;

  @ManyToOne(() => UserEntity, (user: UserEntity) => user.groupMembers, {
    onDelete: 'CASCADE',
    eager: false,
  })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;
}
