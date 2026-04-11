import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuestionBankService } from './services/question-bank.service';
import { QuestionBankController } from './question-bank.controller';
import { QuestionBankEntity } from './question-bank.entity';
import { ClassModule } from 'src/class/class.module';
import { QuestionModule } from 'src/question/question.module';
import { AnswerModule } from 'src/answer/answer.module';
import { QuestionBankQuestionEntity } from 'src/question-bank-question/question-bank-question.entity';
import { QuestionBankImportService } from './services/question-bank-import.service';
import { PdfImageExtractorService } from './services/pdf-image-extractor.service';
import { QuestionParserService } from './services/question-parser.service';
import { ExamSetEntity } from 'src/exam-set/exam-set.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      QuestionBankEntity,
      QuestionBankQuestionEntity,
      ExamSetEntity,
    ]),
    ClassModule,
    forwardRef(() => QuestionModule),
    forwardRef(() => AnswerModule),
  ],
  providers: [
    QuestionBankService,
    QuestionBankImportService,
    PdfImageExtractorService,
    QuestionParserService,
  ],
  controllers: [QuestionBankController],
  exports: [QuestionBankService],
})
export class QuestionBankModule {}
