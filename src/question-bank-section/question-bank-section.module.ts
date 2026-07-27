import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuestionBankEntity } from 'src/question-bank/question-bank.entity';
import { QuestionBankSectionController } from './question-bank-section.controller';
import { QuestionBankSectionEntity } from './question-bank-section.entity';
import { QuestionBankSectionService } from './question-bank-section.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([QuestionBankSectionEntity, QuestionBankEntity]),
  ],
  controllers: [QuestionBankSectionController],
  providers: [QuestionBankSectionService],
  exports: [QuestionBankSectionService],
})
export class QuestionBankSectionModule {}
