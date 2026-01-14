import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LectureDownloadLogEntity } from '../entity/lecture_download_log.entity';
import {
  CreateDownloadLogDto,
  GetDownloadLogQueryDto,
} from '../dto/download-log.dto';
import { PaginationResponseDto } from 'src/common/dto/pagination.dto';
import { ERROR_MESSAGES } from 'src/common/constant/error-messages.constant';
import { UserType } from 'src/common/enum/user-type.enum';

@Injectable()
export class LectureDownloadLogService {
  constructor(
    @InjectRepository(LectureDownloadLogEntity)
    private readonly downloadLogRepository: Repository<LectureDownloadLogEntity>,
  ) {}

  async create(dto: CreateDownloadLogDto, userId: string): Promise<void> {
    const log = new LectureDownloadLogEntity();
    log.lectureId = dto.lectureId;
    log.path = dto.path;
    log.type = dto.type;
    log.createdBy = userId;

    await this.downloadLogRepository.save(log);
  }

  async findAll(
    query: GetDownloadLogQueryDto,
    userId: string,
  ): Promise<PaginationResponseDto<LectureDownloadLogEntity>> {
    const { page = 1, size = 10, lectureId } = query;

    const qb = this.downloadLogRepository
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.lecture', 'lecture')
      .leftJoinAndSelect('log.user', 'user')
      .orderBy('log.createdAt', 'DESC');

    if (lectureId) {
      qb.andWhere('log.lectureId = :lectureId', { lectureId });
    }

    qb.andWhere('log.createdBy = :userId', { userId });

    qb.skip((page - 1) * size).take(size);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      total,
      page,
      size,
    };
  }

  async delete(id: string, userId: string, userType: UserType): Promise<void> {
    const log = await this.downloadLogRepository.findOne({
      where: { id },
    });

    if (!log) {
      throw new NotFoundException(
        ERROR_MESSAGES.NOT_FOUND_WITH_ID('Lịch sử tải xuống', id),
      );
    }

    // Chỉ cho phép chủ sở hữu hoặc admin xóa
    if (userType !== UserType.ADMIN && log.createdBy !== userId) {
      throw new ForbiddenException(
        'Bạn không có quyền xóa lịch sử tải xuống này',
      );
    }

    await this.downloadLogRepository.delete(id);
  }
}
