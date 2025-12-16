import { UserType } from '../common/enum/user-type.enum.js';
import { BaseEntity } from '../common/sql/base.entity.js';
import { Entity, Column, ManyToMany } from 'typeorm';
import { Gender } from './enum/gender.enum.js';
import { Status } from './enum/status.enum.js';

@Entity('user')
export class UserEntity extends BaseEntity {
  // ===== Thông tin đăng nhập =====
  @Column({ name: 'user_name', type: 'text', nullable: false, unique: true })
  userName!: string;

  @Column({ name: 'hash_password', type: 'text', nullable: false })
  hashPassword!: string;

  @Column({ type: 'text', nullable: false, unique: true })
  email!: string;

  // ===== Thông tin cá nhân =====
  @Column({ name: 'full_name', type: 'text', nullable: true })
  fullName?: string;

  @Column({ name: 'phone_number', type: 'text', nullable: true })
  phoneNumber?: string;

  @Column({ type: 'date', nullable: true })
  birthday?: Date;

  @Column({ name: 'gender', type: 'enum', enum: Gender, nullable: true })
  gender?: Gender;

  @Column({ name: 'citizen_id', type: 'text', nullable: true })
  citizenId?: string;

  @Column({ type: 'text', nullable: true })
  address?: string;

  @Column({ type: 'text', nullable: true })
  note?: string;

  // ===== Loại & trạng thái =====
  @Column({ name: 'user_type', type: 'enum', enum: UserType, nullable: false })
  userType!: UserType; // ADMIN | TEACHER

  @Column({ name: 'status', type: 'enum', enum: Status, nullable: true })
  status?: Status; // ACTIVE | INACTIVE | DELETED

  @Column({ name: 'is_disabled', type: 'boolean', default: false })
  isDisabled!: boolean;

  @Column({ name: 'disabled_at', type: 'timestamp', nullable: true })
  disabledAt?: Date;

  @Column({ name: 'activated_date', type: 'date', nullable: true })
  activatedDate?: Date;

  @Column({ name: 'expired_date', type: 'date', nullable: true })
  expiredDate?: Date;

  // ===== Quyền (checkbox) =====
  @Column({ name: 'can_create_teacher_code', type: 'boolean', default: false })
  canCreateTeacherCode!: boolean;

  @Column({ name: 'can_create_admin_code', type: 'boolean', default: false })
  canCreateAdminCode!: boolean;

  @Column({ name: 'can_add_lesson', type: 'boolean', default: false })
  canAddLesson!: boolean;

  @Column({ name: 'can_update_lesson', type: 'boolean', default: false })
  canUpdateLesson!: boolean;

  @Column({ name: 'can_manage_lesson', type: 'boolean', default: false })
  canManageLesson!: boolean;

  @Column({ name: 'can_manage_account', type: 'boolean', default: false })
  canManageAccount!: boolean;

  @Column({ name: 'is_linked_account', type: 'boolean', default: false })
  isLinkedAccount!: boolean;

  // ===== Thông tin sử dụng =====
  @Column({ name: 'last_login_at', type: 'timestamp', nullable: true })
  lastLoginAt?: Date;

  @Column({ name: 'last_login_ip', type: 'text', nullable: true })
  lastLoginIp?: string;

  @Column({ name: 'created_ip', type: 'text', nullable: true })
  createdIp?: string;

  /**
   * Quan hệ many-to-many với Group
   * Một user có thể thuộc nhiều groups
   */
  @ManyToMany('GroupEntity', 'users')
  groups?: import('../group/group.entity').GroupEntity[];
}
