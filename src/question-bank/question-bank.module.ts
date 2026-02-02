import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuestionBankService } from './question-bank.service';
import { QuestionBankController } from './question-bank.controller';
import { QuestionBankEntity } from './question-bank.entity';
import { ClassModule } from 'src/class/class.module';
import { QuestionModule } from 'src/question/question.module';
import { AnswerModule } from 'src/answer/answer.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([QuestionBankEntity]),
    ClassModule,
    forwardRef(() => QuestionModule),
    forwardRef(() => AnswerModule),
  ],
  providers: [QuestionBankService],
  controllers: [QuestionBankController],
  exports: [QuestionBankService],
})
export class QuestionBankModule {}
