import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttemptEntity } from 'src/attempt/attempt.entity';
import { ExamSetQuestionBankEntity } from 'src/exam-set-question-bank/exam-set-question-bank.entity';
import { QuestionBankQuestionEntity } from 'src/question-bank-question/question-bank-question.entity';
import { StudentEntity } from 'src/student/student.entity';
import { StudentAnswerEntity } from 'src/student-answer/student-answer.entity';
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
      StudentAnswerEntity,
      StudentGroupEntity,
      StudentGroupMemberEntity,
      SchoolEntity,
      QuestionBankQuestionEntity,
      ExamSetQuestionBankEntity,
    ]),
  ],
  controllers: [ReportController],
  providers: [ReportService],
  exports: [ReportService],
})
export class ReportModule {}
