import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuestionBankService } from './question-bank.service';
import { QuestionBankController } from './question-bank.controller';
import { QuestionBankEntity } from './question-bank.entity';
import { ClassModule } from 'src/class/class.module';

@Module({
  imports: [TypeOrmModule.forFeature([QuestionBankEntity]), ClassModule],
  providers: [QuestionBankService],
  controllers: [QuestionBankController],
  exports: [QuestionBankService],
})
export class QuestionBankModule {}
