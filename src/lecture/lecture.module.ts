import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LectureService } from './services/lecture.service';
import { LectureController } from './lecture.controller';
import { LectureUserService } from './services/lecture_user.service';
import { LectureUserController } from './controller/lecture_user.controller';
import { LectureGroupService } from './services/lecture_group.service';
import { LectureGroupController } from './controller/lecture_group.controller';
import { LectureDownloadLogService } from './services/lecture_download_log.service';
import { LectureDownloadLogController } from './controller/lecture_download_log.controller';
import { LectureEntity } from './entity/lecture.entity';
import { LectureGroupEntity } from './entity/lecture_group.entity';
import { LectureResourceEntity } from './entity/lecture_resource.entity';
import { LectureUserEntity } from './entity/lecture_user.entity';
import { LectureDownloadLogEntity } from './entity/lecture_download_log.entity';
import { UserModule } from 'src/user/user.module';
import { ClassModule } from 'src/class/class.module';
import { GroupModule } from 'src/group/group.module';
import { CourseModule } from 'src/course/course.module';
import { UploadModule } from 'src/upload/upload.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LectureEntity,
      LectureResourceEntity,
      LectureGroupEntity,
      LectureUserEntity,
      LectureDownloadLogEntity,
    ]),
    UserModule,
    ClassModule,
    GroupModule,
    CourseModule,
    UploadModule,
  ],
  providers: [
    LectureService,
    LectureUserService,
    LectureGroupService,
    LectureDownloadLogService,
  ],
  controllers: [
    LectureUserController,
    LectureGroupController,
    LectureDownloadLogController,
    LectureController,
  ],
  exports: [
    LectureService,
    LectureUserService,
    LectureGroupService,
    LectureDownloadLogService,
  ],
})
export class LectureModule {}
