import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LectureService } from './services/lecture.service';
import { LectureController } from './lecture.controller';
import { LectureContextService as LectureContextUserService } from './services/lecture_context_user.service';
import { LectureContextController as LectureContextUserController } from './controller/lecture_context_user.controller';
import { LectureContextService } from './services/lecture_context.service';
import { LectureContextController } from './controller/lecture_context.controller';
import { LectureDownloadLogService } from './services/lecture_download_log.service';
import { LectureDownloadLogController } from './controller/lecture_download_log.controller';
import { LectureEntity } from './entity/lecture.entity';
import { LectureContextEntity } from './entity/lecture_context.entity';
import { LectureResourceEntity } from './entity/lecture_resource.entity';
import { LectureContextUserEntity } from './entity/lecture_context_user.entity';
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
      LectureContextEntity,
      LectureContextUserEntity,
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
    LectureContextUserService,
    LectureContextService,
    LectureDownloadLogService,
  ],
  controllers: [
    LectureContextUserController,
    LectureContextController,
    LectureDownloadLogController,
    LectureController,
  ],
  exports: [
    LectureService,
    LectureContextUserService,
    LectureContextService,
    LectureDownloadLogService,
  ],
})
export class LectureModule {}
