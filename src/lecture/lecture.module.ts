import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LectureService } from './services/lecture.service';
import { LectureController } from './lecture.controller';
import { LectureContextService } from './services/lecture_context.service';
import { LectureContextController } from './controller/lecture_context.controller';
import { LectureEntity } from './entity/lecture.entity';
import { LectureContextEntity } from './entity/lecture_context.entity';
import { LectureResourceEntity } from './entity/lecture_resource.entity';
import { LectureContextUserEntity } from './entity/lecture_context_user.entity';
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
    ]),
    UserModule,
    ClassModule,
    GroupModule,
    CourseModule,
    UploadModule,
  ],
  providers: [LectureService, LectureContextService],
  controllers: [LectureController, LectureContextController],
  exports: [LectureService, LectureContextService],
})
export class LectureModule {}
