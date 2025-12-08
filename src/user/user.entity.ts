import { UserType } from 'src/common/enum/user-type.enum';
import { BaseEntity } from 'src/common/sql/base.entity';
import { Entity, Column } from 'typeorm';

@Entity('users')
export class UserEntity extends BaseEntity {
  @Column({ name: 'user_name', type: 'text', nullable: false, unique: true })
  userName!: string;

  @Column({ name: 'full_name', type: 'text' })
  fullName?: string;

  @Column({ name: 'hash_password', type: 'text', nullable: false })
  hashPassword!: string;

  @Column({ type: 'text', nullable: false, unique: true })
  email!: string;

  @Column({ name: 'phone_number', type: 'text', nullable: true })
  phoneNumber?: string;

  @Column({ name: 'user_type', type: 'enum' })
  userType!: UserType;
}
