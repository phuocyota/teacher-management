import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lecture } from './lecture.entity';
import { CreateLectureDto, UpdateLectureDto } from './dto/lecture.dto';

@Injectable()
export class LectureService {
  constructor(
    @InjectRepository(Lecture)
    private readonly lectureRepository: Repository<Lecture>,
  ) {}

  async create(payload: CreateLectureDto) {
    const lecture = this.lectureRepository.create(payload);
    return this.lectureRepository.save(lecture);
  }

  async findAll(): Promise<Lecture[]> {
    return this.lectureRepository.find();
  }

  async findOne(id: string): Promise<Lecture> {
    const lecture = await this.lectureRepository.findOne({ where: { id } });
    if (!lecture) {
      throw new NotFoundException(`Lecture with id ${id} not found`);
    }
    return lecture;
  }

  async update(id: string, payload: UpdateLectureDto) {
    const lecture = await this.findOne(id);
    Object.assign(lecture, payload);
    return this.lectureRepository.save(lecture);
  }

  async remove(id: string) {
    const lecture = await this.findOne(id);
    await this.lectureRepository.remove(lecture);
    return { deleted: true };
  }
}
