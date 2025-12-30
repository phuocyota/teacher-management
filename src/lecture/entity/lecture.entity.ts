import { Entity, Column, OneToMany, Index } from 'typeorm';
import { BaseEntity } from '../../common/sql/base.entity';
import { LectureResourceEntity } from './lecture_resource.entity';
import { LectureContextEntity } from './lecture_context.entity';

@Entity('lecture')
export class LectureEntity extends BaseEntity {
  @Column({ unique: true, nullable: true })
  @Index({ unique: true })
  code!: string; // Mã bài giảng (unique)

  @Column()
  title: string; // Tiêu đề bài giảng

  @Column({ type: 'text', nullable: true })
  note?: string; // Ghi chú thêm

  @Column({ name: 'order_column', default: 0 })
  orderColumn: number; // Thứ tự sắp xếp bài giảng

  @Column({ name: 'avatar', type: 'text', nullable: true })
  avatar?: string; // Ảnh đại diện bài giảng

  /* ===== Resources ===== */
  @OneToMany(() => LectureResourceEntity, (resource) => resource.lecture, {
    cascade: true,
  })
  resources?: LectureResourceEntity[];

  //context
  @OneToMany(() => LectureContextEntity, (context) => context.lecture, {
    cascade: true,
  })
  contexts?: LectureContextEntity[];
}
