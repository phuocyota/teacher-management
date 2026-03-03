import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StudentAnswerController } from './student-answer.controller';
import { StudentAnswerService } from './student-answer.service';
import { StudentAnswerEntity } from './student-answer.entity';
import { AttemptModule } from 'src/attempt/attempt.module';
import { QuestionModule } from 'src/question/question.module';
import { AnswerModule } from 'src/answer/answer.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([StudentAnswerEntity]),
    AttemptModule,
    QuestionModule,
    AnswerModule,
  ],
  controllers: [StudentAnswerController],
  providers: [StudentAnswerService],
  exports: [StudentAnswerService],
})
export class StudentAnswerModule {}
