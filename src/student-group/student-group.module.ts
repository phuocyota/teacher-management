import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StudentGroupController } from './student-group.controller';
import { StudentGroupService } from './student-group.service';
import { StudentGroupEntity } from './student-group.entity';
import { SchoolModule } from 'src/school/school.module';

@Module({
  imports: [TypeOrmModule.forFeature([StudentGroupEntity]), SchoolModule],
  controllers: [StudentGroupController],
  providers: [StudentGroupService],
  exports: [StudentGroupService],
})
export class StudentGroupModule {}
