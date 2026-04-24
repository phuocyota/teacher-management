import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuestionService } from './question.service';
import { QuestionController } from './question.controller';
import { QuestionEntity } from './question.entity';
import { QuestionBankModule } from 'src/question-bank/question-bank.module';
import { QuestionBankQuestionModule } from 'src/question-bank-question/question-bank-question.module';
import { AnswerEntity } from 'src/answer/answer.entity';
import { UploadModule } from 'src/upload/upload.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([QuestionEntity, AnswerEntity]),
    forwardRef(() => QuestionBankModule),
    forwardRef(() => QuestionBankQuestionModule),
    UploadModule,
  ],
  providers: [QuestionService],
  controllers: [QuestionController],
  exports: [QuestionService],
})
export class QuestionModule {}
