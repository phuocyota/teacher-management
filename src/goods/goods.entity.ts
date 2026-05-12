import { BaseEntity } from 'src/common/sql/base.entity';
import { Column, Entity, OneToMany } from 'typeorm';
import { OrderEntity } from 'src/order/order.entity';

@Entity('goods')
export class GoodsEntity extends BaseEntity {
  @Column({
    name: 'code',
    type: 'varchar',
    length: 50,
    nullable: false,
    unique: true,
  })
  code!: string;

  @Column({
    name: 'name',
    type: 'varchar',
    length: 255,
    nullable: false,
  })
  name!: string;

  @Column({ name: 'unit', type: 'varchar', length: 50, nullable: true })
  unit?: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description?: string;

  @OneToMany(() => OrderEntity, (order) => order.goods)
  orders?: OrderEntity[];
}
