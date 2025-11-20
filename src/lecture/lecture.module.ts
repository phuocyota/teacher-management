import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LectureService } from './lecture.service';
import { LectureController } from './lecture.controller';
import { Lecture } from './lecture.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Lecture])],
  providers: [LectureService],
  controllers: [LectureController],
})
export class LectureModule {}
