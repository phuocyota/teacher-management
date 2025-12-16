import { BaseEntity } from 'src/common/sql/base.entity';
import { Entity, Column } from 'typeorm';
import { DisplayType } from './enum/display-type.enum';

@Entity('class')
export class ClassEntity extends BaseEntity {
  @Column({
    name: 'code',
    type: 'text',
    nullable: false,
    unique: true,
  })
  code!: string; // Mã lớp học

  @Column({
    name: 'name',
    type: 'text',
    nullable: false,
  })
  name!: string; // Tên lớp học

  @Column({
    name: 'order_number',
    type: 'int',
    nullable: false,
  })
  orderNumber!: number; // Số thứ tự của lớp học

  @Column({
    name: 'display_type',
    type: 'enum',
    enum: DisplayType,
    nullable: false,
    default: DisplayType.NONE,
  })
  displayType!: DisplayType; // Loại hiển thị của lớp học

  @Column({
    name: 'current_image',
    type: 'text',
    nullable: true,
  })
  currentImage?: string; // Ảnh hiện tại của lớp học

  @Column({
    name: 'note',
    type: 'text',
    nullable: true,
  })
  note?: string; // Ghi chú về lớp học
}
