import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  PrimaryGeneratedColumn,
  Index,
} from 'typeorm';
import { LectureEntity } from './lecture.entity';
import { UserEntity } from 'src/user/user.entity';
import { PermissionType } from '../enum/permission-type.enum';

@Entity('teacher_lecture_permission')
@Index(['lectureId', 'teacherId'], { unique: true })
export class TeacherLecturePermissionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'lecture_id' })
  lectureId: string;

  @ManyToOne(() => LectureEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lecture_id' })
  lecture: LectureEntity;

  @Column({ name: 'teacher_id' })
  teacherId: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'teacher_id' })
  teacher: UserEntity;

  @Column({
    name: 'permission_type',
    type: 'enum',
    enum: PermissionType,
    default: PermissionType.VIEW,
  })
  permissionType: PermissionType;

  @Column({ name: 'granted_by' })
  grantedBy: string;

  @Column({ name: 'expires_at', type: 'timestamp', nullable: true })
  expiresAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
