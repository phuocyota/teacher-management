import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TeacherModule } from './teacher/teacher.module';
import { LectureModule } from './lecture/lecture.module';
import { Teacher } from './teacher/teacher.entity';
import { Lecture } from './lecture/lecture.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'postgres',
      password: 'your_password',
      database: 'teacher_db',
      entities: [Teacher, Lecture],
      synchronize: true, // chỉ dùng dev
    }),
    TeacherModule,
    LectureModule,
  ],
})
export class AppModule {}
