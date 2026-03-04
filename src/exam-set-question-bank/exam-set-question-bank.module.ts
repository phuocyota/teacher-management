import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExamSetQuestionBankService } from './exam-set-question-bank.service';
import { ExamSetQuestionBankController } from './exam-set-question-bank.controller';
import { ExamSetQuestionBankEntity } from './exam-set-question-bank.entity';
import { ExamSetModule } from 'src/exam-set/exam-set.module';
import { QuestionBankModule } from 'src/question-bank/question-bank.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ExamSetQuestionBankEntity]),
    ExamSetModule,
    QuestionBankModule,
  ],
  providers: [ExamSetQuestionBankService],
  controllers: [ExamSetQuestionBankController],
  exports: [ExamSetQuestionBankService],
})
export class ExamSetQuestionBankModule {}
