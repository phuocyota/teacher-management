import { Module } from '@nestjs/common';
import { LectureService } from './lecture.service';
import { LectureController } from './lecture.controller';

@Module({
  providers: [LectureService],
  controllers: [LectureController]
})
export class LectureModule {}
