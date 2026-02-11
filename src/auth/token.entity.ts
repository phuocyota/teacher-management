import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('token')
export class TokenEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  token: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'expired_at', type: 'timestamp' })
  expiredAt: Date;
}
