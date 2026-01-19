import { Entity, Column, OneToMany, Generated } from 'typeorm';
import { BaseEntity } from 'src/common/sql/base.entity';
import { UserGroupEntity } from '../../user-group/entity/user-group.entity';
import { GroupType } from '../enum/group-type.enum';

@Entity('group')
export class GroupEntity extends BaseEntity {
  @Column({ name: 'code', type: 'int', unique: true })
  @Generated('increment')
  code: number;

  @Column({ name: 'name', type: 'text' })
  name: string;

  @Column({
    name: 'type',
    type: 'enum',
    enum: GroupType,
    default: GroupType.PERSONAL,
  })
  type: GroupType;

  /**
   * Quan hệ one-to-many với UserGroupEntity
   * Một group có nhiều user_group relationships
   */
  @OneToMany(() => UserGroupEntity, (userGroup) => userGroup.group, {
    cascade: true,
    onDelete: 'CASCADE',
  })
  members?: UserGroupEntity[];
}
