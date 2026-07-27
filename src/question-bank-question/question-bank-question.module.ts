import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuestionBankQuestionService } from './question-bank-question.service';
import { QuestionBankQuestionController } from './question-bank-question.controller';
import { QuestionBankQuestionEntity } from './question-bank-question.entity';
import { QuestionBankModule } from 'src/question-bank/question-bank.module';
import { QuestionModule } from 'src/question/question.module';
import { QuestionBankSectionModule } from 'src/question-bank-section/question-bank-section.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([QuestionBankQuestionEntity]),
    forwardRef(() => QuestionBankModule),
    forwardRef(() => QuestionModule),
    QuestionBankSectionModule,
  ],
  providers: [QuestionBankQuestionService],
  controllers: [QuestionBankQuestionController],
  exports: [QuestionBankQuestionService],
})
export class QuestionBankQuestionModule {}
