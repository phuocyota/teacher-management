import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LectureEntity } from './lecture.entity';
import { BaseService } from 'src/common/sql/base.service';

@Injectable()
export class LectureService extends BaseService<LectureEntity> {
  constructor(
    @InjectRepository(LectureEntity)
    lectureRepository: Repository<LectureEntity>,
  ) {
    super(lectureRepository);
  }

  protected getEntityName(): string {
    return 'Lecture';
  }
}
