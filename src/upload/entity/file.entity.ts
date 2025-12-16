import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/common/sql/base.entity';
import { FileVisibility } from '../enum/file-visibility.enum';

@Entity('files')
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
    name: 'visibility',
    type: 'enum',
    enum: FileVisibility,
    default: FileVisibility.PRIVATE,
  })
  visibility: FileVisibility;

  @Column({ name: 'uploaded_by' })
  uploadedBy: string;

  @Column({ name: 'description', nullable: true })
  description?: string;
}
