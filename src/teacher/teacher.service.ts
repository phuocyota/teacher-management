import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TeacherEntity } from './teacher.entity';
import { BaseService } from 'src/common/sql/base.service';

@Injectable()
export class TeacherService extends BaseService<TeacherEntity> {
  constructor(
    @InjectRepository(TeacherEntity)
    teacherRepository: Repository<TeacherEntity>,
  ) {
    super(teacherRepository);
  }

  protected getEntityName(): string {
    return 'Teacher';
  }
}
