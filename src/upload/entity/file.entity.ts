import { Entity, Column } from 'typeorm';
import { BaseEntity } from 'src/common/sql/base.entity';
import { FileType } from '../enum/file-visibility.enum';

@Entity('file')
export class FileEntity extends BaseEntity {
  @Column({ name: 'original_name' })
  originalName: string;

  @Column({ name: 'filename', unique: true })
  filename: string;

  @Column({ name: 'path' })
  path: string;

  @Column({ name: 'mimetype' })
  mimetype: string;

  @Column({ name: 'size', type: 'bigint' })
  size: number;

  @Column({
    name: 'file_type',
    type: 'enum',
    enum: FileType,
    default: FileType.NORMAL,
  })
  fileType: FileType;

  @Column({ name: 'uploaded_by' })
  uploadedBy: string;

  @Column({ name: 'description', nullable: true })
  description?: string;
}
