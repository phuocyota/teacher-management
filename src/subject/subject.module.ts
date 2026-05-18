import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubjectService } from './subject.service';
import { SubjectController } from './subject.controller';
import { SubjectEntity } from './subject.entity';
import { SchoolSubjectEntity } from './school-subject.entity';
import { StudentGroupSubjectEntity } from './student-group-subject.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SubjectEntity,
      SchoolSubjectEntity,
      StudentGroupSubjectEntity,
    ]),
  ],
  providers: [SubjectService],
  controllers: [SubjectController],
  exports: [SubjectService],
})
export class SubjectModule {}
