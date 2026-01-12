import { BaseEntity } from 'src/common/sql/base.entity';
import { Column, Entity, JoinColumn, ManyToOne, Index } from 'typeorm';
import { LectureEntity } from './lecture.entity';
import { UserEntity } from 'src/user/user.entity';

@Entity('lecture_download_log')
@Index(['lectureId', 'userId'])
export class LectureDownloadLogEntity extends BaseEntity {
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

  @Column({ type: 'text' })
  path: string; // Đường dẫn file đã tải

  @Column({ type: 'varchar', length: 100 })
  type: string; // Loại file (pdf, docx, etc.)
}
