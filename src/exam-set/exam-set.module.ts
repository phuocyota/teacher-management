import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExamSetService } from './exam-set.service';
import { ExamSetController } from './exam-set.controller';
import { ExamSetEntity } from './exam-set.entity';
import { ClassModule } from 'src/class/class.module';

@Module({
  imports: [TypeOrmModule.forFeature([ExamSetEntity]), ClassModule],
  providers: [ExamSetService],
  controllers: [ExamSetController],
  exports: [ExamSetService],
})
export class ExamSetModule {}
