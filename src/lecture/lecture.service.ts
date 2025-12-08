import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lecture } from './lecture.entity';
import { BaseService } from 'src/common/sql/base.service';

@Injectable()
export class LectureService extends BaseService<Lecture> {
  constructor(
    @InjectRepository(Lecture)
    lectureRepository: Repository<Lecture>,
  ) {
    super(lectureRepository);
  }

  protected getEntityName(): string {
    return 'Lecture';
  }
}
