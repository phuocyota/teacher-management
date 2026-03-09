import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttemptService } from './attempt.service';
import { AttemptController } from './attempt.controller';
import { AttemptEntity } from './attempt.entity';
import { StudentModule } from 'src/student/student.module';
import { QuestionBankModule } from 'src/question-bank/question-bank.module';
import { ExamSetModule } from 'src/exam-set/exam-set.module';
import { StudentEntity } from 'src/student/student.entity';
import { QuestionBankQuestionEntity } from 'src/question-bank-question/question-bank-question.entity';
import { QuestionEntity } from 'src/question/question.entity';
import { AnswerEntity } from 'src/answer/answer.entity';
import { StudentAnswerEntity } from 'src/student-answer/student-answer.entity';
import { ExamSetQuestionBankModule } from 'src/exam-set-question-bank/exam-set-question-bank.module';
import { UserEntity } from 'src/user/user.entity';
import { StudentGroupEntity } from 'src/student-group/student-group.entity';
import { SchoolEntity } from 'src/school/school.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AttemptEntity,
      StudentEntity,
      QuestionBankQuestionEntity,
      QuestionEntity,
      AnswerEntity,
      StudentAnswerEntity,
      UserEntity,
      StudentGroupEntity,
      SchoolEntity,
    ]),
    StudentModule,
    QuestionBankModule,
    ExamSetModule,
    ExamSetQuestionBankModule,
  ],
  providers: [AttemptService],
  controllers: [AttemptController],
  exports: [AttemptService],
})
export class AttemptModule {}
