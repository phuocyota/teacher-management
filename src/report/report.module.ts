import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttemptEntity } from 'src/attempt/attempt.entity';
import { StudentEntity } from 'src/student/student.entity';
import { StudentGroupEntity } from 'src/student-group/student-group.entity';
import { StudentGroupMemberEntity } from 'src/student-group/student-group-member.entity';
import { UserEntity } from 'src/user/user.entity';
import { SchoolEntity } from 'src/school/school.entity';
import { ReportController } from './report.controller';
import { ReportService } from './report.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AttemptEntity,
      UserEntity,
      StudentEntity,
      StudentGroupEntity,
      StudentGroupMemberEntity,
      SchoolEntity,
    ]),
  ],
  controllers: [ReportController],
  providers: [ReportService],
  exports: [ReportService],
})
export class ReportModule {}
