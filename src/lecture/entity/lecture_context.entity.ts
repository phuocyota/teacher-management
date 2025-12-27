import { BaseEntity } from 'src/common/sql/base.entity';
import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { LectureEntity } from './lecture.entity';
import { ClassEntity } from 'src/class/class.entity';
import { CourseEntity } from 'src/course/course.entity';
import { GroupEntity } from 'src/group/entity/group.entity';

@Entity('lecture_context')
export class LectureContextEntity extends BaseEntity {
  /* =======================
   * Lecture (bắt buộc)
   * ======================= */
  @Column({ name: 'lecture_id', type: 'uuid' })
  lectureId: string;

  @ManyToOne(() => LectureEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lecture_id' })
  lecture?: LectureEntity;

  /* =======================
   * Class (optional)
   * ======================= */
  @Column({ name: 'class_id', type: 'uuid', nullable: true })
  classId?: string | null;

  @ManyToOne(() => ClassEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'class_id' })
  class?: ClassEntity | null;

  /* =======================
   * Course (optional)
   * ======================= */
  @Column({ name: 'course_id', type: 'uuid', nullable: true })
  courseId?: string | null;

  @ManyToOne(() => CourseEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'course_id' })
  course?: CourseEntity | null;

  /* =======================
   * Group (optional)
   * ======================= */
  @Column({ name: 'group_id', type: 'uuid', nullable: true })
  groupId?: string | null;

  @ManyToOne(() => GroupEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'group_id' })
  group?: GroupEntity | null;
}
