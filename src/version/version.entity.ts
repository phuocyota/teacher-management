import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('version')
@Index(['platform', 'version'], { unique: true })
export class VersionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 50, nullable: false })
  version!: string;

  @Column({ type: 'varchar', length: 50, nullable: false })
  platform!: string;

  @Column({ type: 'text', nullable: false })
  url!: string;

  @Column({ type: 'boolean', nullable: false, default: false })
  mandatory!: boolean;

  @Column({ type: 'text', nullable: true })
  note!: string | null;
}
