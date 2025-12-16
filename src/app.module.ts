import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { TeacherModule } from './teacher/teacher.module';
import { LectureModule } from './lecture/lecture.module';
import { TeacherEntity } from './teacher/teacher.entity';
import { LectureEntity } from './lecture/lecture.entity';
import { UserModule } from './user/user.module';
import { LicenseModule } from './license/license.module';
import { DeviceModule } from './device/device.module';
import { SocketModule } from './socket/socket.module';
import { AuthService } from './auth/auth.service';
import { AuthModule } from './auth/auth.module';
import { AuthGuard } from './common/guard/auth.guard';
import { UserEntity } from './user/user.entity';
import { LicenseEntity } from './license/license.entity';
import { ApprovedDeviceEntity } from './device/entity/approved-device.entity';
import { DeviceRequest } from './device/entity/device-request.entity';
import { ClassModule } from './class/class.module';
import { ClassEntity } from './class/class.entity';

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
          UserEntity,
          ClassEntity,
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
  ],
  providers: [
    AuthService,
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
})
export class AppModule {}
