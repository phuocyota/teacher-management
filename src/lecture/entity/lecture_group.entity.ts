import { BaseEntity } from 'src/common/sql/base.entity';
import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { LectureEntity } from './lecture.entity';
import { GroupEntity } from 'src/group/entity/group.entity';

@Entity('lecture_group')
export class LectureGroupEntity extends BaseEntity {
  /* =======================
   * Lecture (bắt buộc)
   * ======================= */
  @Column({ name: 'lecture_id', type: 'uuid', nullable: false })
  lectureId: string;

  @ManyToOne(() => LectureEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lecture_id' })
  lecture?: LectureEntity;

  /* =======================
   * Group (bắt buộc)
   * ======================= */
  @Column({ name: 'group_id', type: 'uuid', nullable: false })
  groupId: string;

  @ManyToOne(() => GroupEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'group_id' })
  group?: GroupEntity;
}
