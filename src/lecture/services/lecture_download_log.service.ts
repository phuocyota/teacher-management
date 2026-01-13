import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LectureDownloadLogEntity } from '../entity/lecture_download_log.entity';
import {
  CreateDownloadLogDto,
  GetDownloadLogQueryDto,
} from '../dto/download-log.dto';
import { PaginationResponseDto } from 'src/common/dto/pagingation.dto';

@Injectable()
export class LectureDownloadLogService {
  constructor(
    @InjectRepository(LectureDownloadLogEntity)
    private readonly downloadLogRepository: Repository<LectureDownloadLogEntity>,
  ) {}

  async create(dto: CreateDownloadLogDto, userId: string): Promise<void> {
    const log = new LectureDownloadLogEntity();
    log.lectureId = dto.lectureId;
    log.userId = userId;
    log.path = dto.path;
    log.type = dto.type;
    log.createdBy = userId;

    await this.downloadLogRepository.save(log);
  }

  async findAll(
    query: GetDownloadLogQueryDto,
  ): Promise<PaginationResponseDto<LectureDownloadLogEntity>> {
    const { page = 1, size = 10, lectureId, userId, courseId } = query;

    const qb = this.downloadLogRepository
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.lecture', 'lecture')
      .leftJoinAndSelect('log.user', 'user')
      .orderBy('log.createdAt', 'DESC');

    if (lectureId) {
      qb.andWhere('log.lectureId = :lectureId', { lectureId });
    }

    if (userId) {
      qb.andWhere('user.id = :userId', { userId });
    }

    if (courseId) {
      qb.andWhere('lecture.id = :courseId', { courseId });
    }

    qb.skip((page - 1) * size).take(size);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      total,
      page,
      size,
    };
  }
}
