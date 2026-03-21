import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CourseEntity } from './course.entity';
import { ClassEntity } from 'src/class/class.entity';
import { CourseService } from './course.service';
import { CourseController } from './course.controller';
import { UploadModule } from 'src/upload/upload.module';
import { LectureEntity } from 'src/lecture/entity/lecture.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([CourseEntity, ClassEntity, LectureEntity]),
    UploadModule,
  ],
  controllers: [CourseController],
  providers: [CourseService],
  exports: [CourseService],
})
export class CourseModule {}
