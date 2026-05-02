import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StudentController } from './student.controller';
import { StudentService } from './student.service';
import { StudentEntity } from './student.entity';
import { StudentGroupModule } from 'src/student-group/student-group.module';
import { SchoolModule } from 'src/school/school.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([StudentEntity]),
    StudentGroupModule,
    SchoolModule,
  ],
  controllers: [StudentController],
  providers: [StudentService],
  exports: [StudentService],
})
export class StudentModule {}
