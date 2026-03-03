import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttemptService } from './attempt.service';
import { AttemptController } from './attempt.controller';
import { AttemptEntity } from './attempt.entity';
import { StudentModule } from 'src/student/student.module';
import { QuestionBankModule } from 'src/question-bank/question-bank.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AttemptEntity]),
    StudentModule,
    QuestionBankModule,
  ],
  providers: [AttemptService],
  controllers: [AttemptController],
  exports: [AttemptService],
})
export class AttemptModule {}
