import { Entity, Column, ManyToMany, JoinTable, Generated } from 'typeorm';
import { BaseEntity } from 'src/common/sql/base.entity';

@Entity('groups')
export class GroupEntity extends BaseEntity {
  @Column({ name: 'code', type: 'int', unique: true })
  @Generated('increment')
  code: number;

  @Column({ name: 'name', type: 'text' })
  name: string;

  /**
   * Quan hệ many-to-many với User
   * Một group có nhiều users, một user có thể thuộc nhiều groups
   */
  @ManyToMany('UserEntity', 'groups', {
    cascade: true,
  })
  @JoinTable({
    name: 'user_groups', // Tên bảng trung gian
    joinColumn: {
      name: 'group_id',
      referencedColumnName: 'id',
    },
    inverseJoinColumn: {
      name: 'user_id',
      referencedColumnName: 'id',
    },
  })
  users?: import('../user/user.entity').UserEntity[];
}
