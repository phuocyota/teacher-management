import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('golden_bell_room_state')
export class GoldenBellRoomStateEntity {
  @PrimaryColumn({ name: 'room_id', type: 'varchar', length: 255 })
  roomId!: string;

  @Column({ name: 'state', type: 'jsonb', nullable: false })
  state!: object;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
