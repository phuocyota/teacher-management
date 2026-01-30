import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuestionService } from './question.service';
import { QuestionController } from './question.controller';
import { QuestionEntity } from './question.entity';
import { QuestionBankModule } from 'src/question-bank/question-bank.module';

@Module({
  imports: [TypeOrmModule.forFeature([QuestionEntity]), QuestionBankModule],
  providers: [QuestionService],
  controllers: [QuestionController],
  exports: [QuestionService],
})
export class QuestionModule {}
