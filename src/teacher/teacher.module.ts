import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TeacherService } from './teacher.service';
import { TeacherController } from './teacher.controller';
import { TeacherEntity } from './teacher.entity';

@Module({
  imports: [TypeOrmModule.forFeature([TeacherEntity])],
  providers: [TeacherService],
  controllers: [TeacherController],
})
export class TeacherModule {}
