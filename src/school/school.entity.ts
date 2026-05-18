import { Entity, Column, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from 'src/common/sql/base.entity';
import { ZoneEntity } from 'src/zone/zone.entity';
import { UserEntity } from 'src/user/user.entity';
import { SchoolSubjectEntity } from 'src/subject/school-subject.entity';

@Entity('school')
export class SchoolEntity extends BaseEntity {
  @Column({ unique: true })
  code!: string;

  @Column()
  name!: string;

  @Column({ name: 'zone_id', type: 'uuid', nullable: true })
  zoneId!: string | null;

  @Column({ name: 'principal_user_id', type: 'uuid', nullable: true })
  principalUserId!: string | null;

  @ManyToOne(() => ZoneEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'zone_id' })
  zone!: ZoneEntity | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'principal_user_id' })
  principalUser!: UserEntity | null;

  @Column({ nullable: true })
  address?: string;

  @OneToMany(() => SchoolSubjectEntity, (schoolSubject) => schoolSubject.school)
  schoolSubjects!: SchoolSubjectEntity[];
}
