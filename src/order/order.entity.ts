import { BaseEntity } from 'src/common/sql/base.entity';
import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { GoodsEntity } from 'src/goods/goods.entity';

@Entity('order')
export class OrderEntity extends BaseEntity {
  @Column({
    name: 'code',
    type: 'varchar',
    length: 50,
    nullable: false,
    unique: true,
  })
  code!: string;

  @Column({ name: 'goods_id', type: 'uuid', nullable: true })
  goodsId?: string;

  @Column({ name: 'quantity', type: 'int', nullable: true })
  quantity?: number;

  @Column({ name: 'latitude', type: 'double precision', nullable: true })
  latitude?: number;

  @Column({ name: 'longitude', type: 'double precision', nullable: true })
  longitude?: number;

  @Column({ name: 'address', type: 'text', nullable: true })
  address?: string;

  @Column({ name: 'note', type: 'text', nullable: true })
  note?: string;

  @ManyToOne(() => GoodsEntity, (goods) => goods.orders, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'goods_id' })
  goods?: GoodsEntity;
}
