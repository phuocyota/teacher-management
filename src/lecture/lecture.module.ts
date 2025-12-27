import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LectureService } from './services/lecture.service';
import { LectureController } from './lecture.controller';
import { LectureEntity } from './entity/lecture.entity';
import { LectureContextEntity } from './entity/lecture_context.entity';
import { LectureResourceEntity } from './entity/lecture_resource.entity';
import { UserModule } from 'src/user/user.module';
import { ClassModule } from 'src/class/class.module';
import { GroupModule } from 'src/group/group.module';
import { CourseModule } from 'src/course/course.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LectureEntity,
      LectureResourceEntity,
      LectureContextEntity,
    ]),
    UserModule,
    ClassModule,
    GroupModule,
    CourseModule,
  ],
  providers: [LectureService],
  controllers: [LectureController],
  exports: [LectureService],
})
export class LectureModule {}
