import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuestionBankQuestionService } from './question-bank-question.service';
import { QuestionBankQuestionController } from './question-bank-question.controller';
import { QuestionBankQuestionEntity } from './question-bank-question.entity';
import { QuestionBankModule } from 'src/question-bank/question-bank.module';
import { QuestionModule } from 'src/question/question.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([QuestionBankQuestionEntity]),
    QuestionBankModule,
    QuestionModule,
  ],
  providers: [QuestionBankQuestionService],
  controllers: [QuestionBankQuestionController],
  exports: [QuestionBankQuestionService],
})
export class QuestionBankQuestionModule {}
