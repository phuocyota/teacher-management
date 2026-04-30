import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttemptEntity } from 'src/attempt/attempt.entity';
import { GroupEntity } from 'src/group/entity/group.entity';
import { StudentEntity } from 'src/student/student.entity';
import { StudentGroupEntity } from 'src/student-group/student-group.entity';
import { UserEntity } from 'src/user/user.entity';
import { UserGroupEntity } from 'src/user-group/entity/user-group.entity';
import { SchoolEntity } from 'src/school/school.entity';
import { ReportController } from './report.controller';
import { ReportService } from './report.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AttemptEntity,
      GroupEntity,
      UserGroupEntity,
      UserEntity,
      StudentEntity,
      StudentGroupEntity,
      SchoolEntity,
    ]),
  ],
  controllers: [ReportController],
  providers: [ReportService],
  exports: [ReportService],
})
export class ReportModule {}
