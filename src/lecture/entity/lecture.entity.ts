import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity } from '../../common/sql/base.entity';
import { TeacherLecturePermissionEntity } from './teacher-lecture-permission.entity';

@Entity('lecture')
export class LectureEntity extends BaseEntity {
  @Column()
  title: string;

  @Column({ nullable: true })
  description: string;

  @Column({ name: 'file_id', nullable: true })
  fileId?: string;

  /**
   * Quan hệ một-nhiều với TeacherLecturePermission
   * Một bài giảng có nhiều quyền được cấp cho giáo viên
   */
  @OneToMany(
    () => TeacherLecturePermissionEntity,
    (permission) => permission.lecture,
    { cascade: true },
  )
  teacherPermissions?: TeacherLecturePermissionEntity[];
}
