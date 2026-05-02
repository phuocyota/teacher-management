import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SchoolController } from './school.controller';
import { SchoolService } from './school.service';
import { SchoolEntity } from './school.entity';
import { ZoneModule } from 'src/zone/zone.module';
import { UserEntity } from 'src/user/user.entity';
import { StudentGroupEntity } from 'src/student-group/student-group.entity';
import { StudentGroupMemberEntity } from 'src/student-group/student-group-member.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SchoolEntity,
      UserEntity,
      StudentGroupEntity,
      StudentGroupMemberEntity,
    ]),
    ZoneModule,
  ],
  controllers: [SchoolController],
  providers: [SchoolService],
  exports: [SchoolService],
})
export class SchoolModule {}
