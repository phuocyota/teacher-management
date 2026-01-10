//method check array userIds, if userId is exist in table lecture_context_user throw error
import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { LectureContextUserEntity } from '../entity/lecture_context_user.entity';
import { LectureEntity } from '../entity/lecture.entity';
import { runInTransaction } from 'src/common/database/transaction.utils';
import { CreateLectureContextDto } from '../dto/lecture_context.dto';
@Injectable()
export class LectureContextService {
  constructor(
    @InjectRepository(LectureContextUserEntity)
    private readonly lectureContextUserRepository: Repository<LectureContextUserEntity>,
    @InjectRepository(LectureEntity)
    private readonly lectureRepository: Repository<LectureEntity>,
    private readonly entityManager: EntityManager,
  ) {}
  private async validateUserIdsForLecture(
    lectureId: string,
    userIds: string[],
  ): Promise<void> {
    const existingUsers = await this.lectureContextUserRepository.find({
      where: {
        lectureId,
        userId: In(userIds),
      },
    });

    if (existingUsers.length > 0) {
      throw new BadRequestException(
        'Some userIds already exist for this lecture',
      );
    }
  }
  //method create lecture_context_user for array userIds using RunInTransaction
  private async addUsersToLecture(
    lectureId: string,
    userIds: string[],
  ): Promise<void> {
    return runInTransaction(
      this.lectureContextUserRepository.manager,
      async (manager) => {
        const lectureContextUserRepo = manager.getRepository(
          LectureContextUserEntity,
        );
        for (const userId of userIds) {
          const lectureContextUser = new LectureContextUserEntity();
          lectureContextUser.lectureId = lectureId;
          lectureContextUser.userId = userId;
          await lectureContextUserRepo.save(lectureContextUser);
        }
      },
    );
  }
  async create(dto: CreateLectureContextDto): Promise<void> {
    await this.validateUserIdsForLecture(dto.lectureId, dto.userIds);
    return this.addUsersToLecture(dto.lectureId, dto.userIds);
  }
}
