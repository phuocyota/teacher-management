import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExamSetService } from './exam-set.service';
import { ExamSetController } from './exam-set.controller';
import { ExamSetEntity } from './exam-set.entity';
import { ClassModule } from 'src/class/class.module';
import { ExamSetQuestionBankEntity } from 'src/exam-set-question-bank/exam-set-question-bank.entity';
import { QuestionBankQuestionEntity } from 'src/question-bank-question/question-bank-question.entity';
import { ExamSetClassEntity } from 'src/exam-set-class/exam-set-class.entity';
import { QuestionBankSectionEntity } from 'src/question-bank-section/question-bank-section.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ExamSetEntity,
      ExamSetQuestionBankEntity,
      QuestionBankQuestionEntity,
      QuestionBankSectionEntity,
      ExamSetClassEntity,
    ]),
    ClassModule,
  ],
  providers: [ExamSetService],
  controllers: [ExamSetController],
  exports: [ExamSetService],
})
export class ExamSetModule {}
