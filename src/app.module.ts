import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { TeacherModule } from './teacher/teacher.module';
import { LectureModule } from './lecture/lecture.module';
import { TeacherEntity } from './teacher/teacher.entity';
import { LectureEntity } from './lecture/entity/lecture.entity';
import { UserModule } from './user/user.module';
import { LicenseModule } from './license/license.module';
import { DeviceModule } from './device/device.module';
import { SocketModule } from './socket/socket.module';
import { AuthService } from './auth/auth.service';
import { AuthModule } from './auth/auth.module';
import { AuthGuard } from './common/guard/auth.guard';
import { AllExceptionsFilter } from './common/filter/all-exceptions.filter';
import { UserEntity } from './user/user.entity';
import { LicenseEntity } from './license/license.entity';
import { ApprovedDeviceEntity } from './device/entity/approved-device.entity';
import { DeviceRequest } from './device/entity/device-request.entity';
import { ClassModule } from './class/class.module';
import { ClassEntity } from './class/class.entity';
import { UploadModule } from './upload/upload.module';
import { FileEntity } from './upload/entity/file.entity';
import { FileAccessEntity } from './upload/entity/file-access.entity';
import { GroupModule } from './group/group.module';
import { GroupEntity } from './group/entity/group.entity';
import { UserGroupEntity } from './user-group/entity/user-group.entity';
import { UserGroupModule } from './user-group/user-group.module';
import { CourseModule } from './course/course.module';
import { CourseEntity } from './course/course.entity';
import { LectureResourceEntity } from './lecture/entity/lecture_resource.entity';
import { LectureGroupEntity } from './lecture/entity/lecture_group.entity';
import { LectureUserEntity } from './lecture/entity/lecture_user.entity';
import { LectureDownloadLogEntity } from './lecture/entity/lecture_download_log.entity';
import { MiddlewareConsumer } from '@nestjs/common';
import { RequestLoggerMiddleware } from './common/middleware/request-logger-middleware';
import { QuestionBankModule } from './question-bank/question-bank.module';
import { QuestionModule } from './question/question.module';
import { AnswerModule } from './answer/answer.module';
import { StudentModule } from './student/student.module';
import { SchoolModule } from './school/school.module';
import { StudentGroupModule } from './student-group/student-group.module';
import { SchoolEntity } from './school/school.entity';
import { StudentGroupEntity } from './student-group/student-group.entity';
import { StudentEntity } from './student/student.entity';
import { QuestionBankEntity } from './question-bank/question-bank.entity';
import { QuestionEntity } from './question/question.entity';
import { AnswerEntity } from './answer/answer.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST'),
        port: configService.get('DB_PORT'),
        username: configService.get('DB_USERNAME'),
        password: configService.get('DB_PASSWORD'),
        database: configService.get('DB_DATABASE'),
        entities: [
          TeacherEntity,
          LectureEntity,
          UserEntity,
          LicenseEntity,
          ApprovedDeviceEntity,
          DeviceRequest,
          ClassEntity,
          CourseEntity,
          FileEntity,
          FileAccessEntity,
          GroupEntity,
          UserGroupEntity,
          LectureResourceEntity,
          LectureGroupEntity,
          LectureUserEntity,
          LectureDownloadLogEntity,
          SchoolEntity,
          StudentGroupEntity,
          StudentEntity,
          QuestionBankEntity,
          QuestionEntity,
          AnswerEntity,
        ],
        synchronize: true,
      }),
    }),
    TeacherModule,
    LectureModule,
    UserModule,
    LicenseModule,
    DeviceModule,
    SocketModule,
    AuthModule,
    ClassModule,
    CourseModule,
    UploadModule,
    GroupModule,
    UserGroupModule,
    QuestionBankModule,
    QuestionModule,
    AnswerModule,
    StudentModule,
    SchoolModule,
    StudentGroupModule,
  ],
  providers: [
    AuthService,
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*');
  }
}
