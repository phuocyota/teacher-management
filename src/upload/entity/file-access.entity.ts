import { Entity, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { BaseEntity } from 'src/common/sql/base.entity';
import { FileAccessType } from '../enum/file-visibility.enum';
import { FileEntity } from './file.entity';

@Entity('file_access')
@Unique(['fileId', 'userId'])
export class FileAccessEntity extends BaseEntity {
  @Column({ name: 'file_id' })
  fileId: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({
    name: 'access_type',
    type: 'enum',
    enum: FileAccessType,
    default: FileAccessType.VIEW,
  })
  accessType: FileAccessType;

  @Column({ name: 'granted_by' })
  grantedBy: string;

  @Column({ name: 'expires_at', nullable: true })
  expiresAt?: Date;

  @ManyToOne(() => FileEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'file_id' })
  file: FileEntity;
}
