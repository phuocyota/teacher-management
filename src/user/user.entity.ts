import { BaseEntity } from 'src/common/sql/base.entity';
import { Entity, Column } from 'typeorm';

@Entity('users')
export class UserEntity extends BaseEntity {
  @Column()
  userName: string;

  @Column()
  password!: string;

  @Column({ length: 100 })
  name: string;

  @Column({ unique: true })
  email: string;
}
