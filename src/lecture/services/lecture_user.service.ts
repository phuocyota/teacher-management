//method check array userIds, if userId is exist in table lecture_context_user throw error
import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { LectureUserEntity } from '../entity/lecture_user.entity';
import { runInTransaction } from 'src/common/database/transaction.utils';
import {
  CreateLectureUserDto,
  UpdateLectureUserDto,
  BulkCreateLectureUserDto,
} from '../dto/lecture_user.dto';
import { diffArray } from 'src/common/utils/array-diff.utils';
import { JwtPayload } from 'src/common/interface/jwt-payload.interface';
@Injectable()
export class LectureUserService {
  constructor(
    @InjectRepository(LectureUserEntity)
    private readonly LectureUserRepository: Repository<LectureUserEntity>,
  ) {}
  //method check array userIds, if userId is exist in table lecture_context_user throw error
  private async validateUserIdsForLecture(
    lectureId: string,
    userIds: string[],
  ): Promise<void> {
    const existingUsers = await this.LectureUserRepository.find({
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
    createdBy: string,
  ): Promise<void> {
    return runInTransaction(
      this.LectureUserRepository.manager,
      async (manager) => {
        const LectureUserRepo = manager.getRepository(LectureUserEntity);
        const entities = userIds.map((userId) => {
          const LectureUser = new LectureUserEntity();
          LectureUser.lectureId = lectureId;
          LectureUser.userId = userId;
          LectureUser.createdBy = createdBy;
          return LectureUser;
        });
        await LectureUserRepo.save(entities);
      },
    );
  }

  //method create lecture_context_user for array userIds
  async create(dto: CreateLectureUserDto, user: JwtPayload): Promise<void> {
    await this.validateUserIdsForLecture(dto.lectureId, dto.userIds);
    return this.addUsersToLecture(dto.lectureId, dto.userIds, user.userId);
  }

  // Update users of a lecture: compute diff and add/remove accordingly
  async update(dto: UpdateLectureUserDto, user: JwtPayload): Promise<void> {
    const lectureId = dto.lectureId;
    const raw = await this.LectureUserRepository.query(
      'SELECT array_agg(user_id) AS user_ids FROM lecture_context_user WHERE lecture_id = $1',
      [lectureId],
    );

    const currentUserIds: string[] = raw?.[0]?.user_ids ?? [];

    const { toAdd, toRemove } = diffArray(currentUserIds, dto.userIds);

    return runInTransaction(
      this.LectureUserRepository.manager,
      async (manager) => {
        const repo = manager.getRepository(LectureUserEntity);

        const ops: Promise<any>[] = [];

        if (toRemove.length > 0) {
          ops.push(
            repo.delete({
              lectureId,
              userId: In(toRemove),
            } as any),
          );
        }

        if (toAdd.length > 0) {
          const entities = toAdd.map((userId) => {
            const lecture = new LectureUserEntity();
            lecture.lectureId = lectureId;
            lecture.userId = userId;
            lecture.createdBy = user.userId;
            return lecture;
          });
          ops.push(repo.save(entities));
        }

        if (ops.length > 0) {
          await Promise.all(ops);
        }
      },
    );
  }

  // Bulk create: tạo records cho nhiều lectures và nhiều users
  async bulkCreate(
    dto: BulkCreateLectureUserDto,
    user: JwtPayload,
  ): Promise<void> {
    return runInTransaction(
      this.LectureUserRepository.manager,
      async (manager) => {
        const repo = manager.getRepository(LectureUserEntity);
        const entities: LectureUserEntity[] = [];

        // Tạo cartesian product: mỗi lecture với mỗi user
        for (const lectureId of dto.lectureIds) {
          for (const userId of dto.userIds) {
            const entity = new LectureUserEntity();
            entity.lectureId = lectureId;
            entity.userId = userId;
            entity.createdBy = user.userId;
            entities.push(entity);
          }
        }

        // Lưu tất cả entities
        await repo.save(entities);
      },
    );
  }
}
