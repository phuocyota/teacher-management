import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LectureService } from './services/lecture.service';
import { LectureController } from './lecture.controller';
import { LectureEntity } from './entity/lecture.entity';
import { LecturePermissionService } from './services/lecture-permission.service';
import { TeacherLecturePermissionEntity } from './entity/teacher-lecture-permission.entity';
import { UserEntity } from 'src/user/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LectureEntity,
      TeacherLecturePermissionEntity,
      UserEntity,
    ]),
  ],
  providers: [LectureService, LecturePermissionService],
  controllers: [LectureController],
  exports: [LectureService, LecturePermissionService],
})
export class LectureModule {}
