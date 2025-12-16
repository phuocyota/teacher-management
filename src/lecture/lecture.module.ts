import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LectureService } from './lecture.service';
import { LectureController } from './lecture.controller';
import { LectureEntity } from './lecture.entity';

@Module({
  imports: [TypeOrmModule.forFeature([LectureEntity])],
  providers: [LectureService],
  controllers: [LectureController],
})
export class LectureModule {}
