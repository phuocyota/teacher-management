import { BaseEntity } from 'src/common/sql/base.entity';
import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { LectureEntity } from './lecture.entity';
import { UserEntity } from '../../user/user.entity';

@Entity('lecture_user')
export class LectureUserEntity extends BaseEntity {
  @Column({ name: 'lecture_id', type: 'uuid' })
  lectureId: string;

  @ManyToOne(() => LectureEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lecture_id' })
  lecture?: LectureEntity;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: UserEntity;
}
