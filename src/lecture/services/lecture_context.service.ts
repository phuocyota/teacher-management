//method check array userIds, if userId is exist in table lecture_context_user throw error
import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { LectureContextUserEntity } from '../entity/lecture_context_user.entity';
import { runInTransaction } from 'src/common/database/transaction.utils';
import {
  CreateLectureContextDto,
  UpdateLectureContextDto,
} from '../dto/lecture_context.dto';
import { diffArray } from 'src/common/utils/array-diff.utils';
import { JwtPayload } from 'src/common/interface/jwt-payload.interface';
@Injectable()
export class LectureContextService {
  constructor(
    @InjectRepository(LectureContextUserEntity)
    private readonly lectureContextUserRepository: Repository<LectureContextUserEntity>,
  ) {}
  //method check array userIds, if userId is exist in table lecture_context_user throw error
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
    createdBy: string,
  ): Promise<void> {
    return runInTransaction(
      this.lectureContextUserRepository.manager,
      async (manager) => {
        const lectureContextUserRepo = manager.getRepository(
          LectureContextUserEntity,
        );
        const entities = userIds.map((userId) => {
          const lectureContextUser = new LectureContextUserEntity();
          lectureContextUser.lectureId = lectureId;
          lectureContextUser.userId = userId;
          lectureContextUser.createdBy = createdBy;
          return lectureContextUser;
        });
        await lectureContextUserRepo.save(entities);
      },
    );
  }

  //method create lecture_context_user for array userIds
  async create(dto: CreateLectureContextDto, user: JwtPayload): Promise<void> {
    await this.validateUserIdsForLecture(dto.lectureId, dto.userIds);
    return this.addUsersToLecture(dto.lectureId, dto.userIds, user.userId);
  }

  // Update users of a lecture: compute diff and add/remove accordingly
  async update(dto: UpdateLectureContextDto, user: JwtPayload): Promise<void> {
    const lectureId = dto.lectureId;
    const raw = await this.lectureContextUserRepository.query(
      'SELECT array_agg(user_id) AS user_ids FROM lecture_context_user WHERE lecture_id = $1',
      [lectureId],
    );

    const currentUserIds: string[] = raw?.[0]?.user_ids ?? [];

    const { toAdd, toRemove } = diffArray(currentUserIds, dto.userIds);

    return runInTransaction(
      this.lectureContextUserRepository.manager,
      async (manager) => {
        const repo = manager.getRepository(LectureContextUserEntity);

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
            const lectureContextUser = new LectureContextUserEntity();
            lectureContextUser.lectureId = lectureId;
            lectureContextUser.userId = userId;
            lectureContextUser.createdBy = user.userId;
            return lectureContextUser;
          });
          ops.push(repo.save(entities));
        }

        if (ops.length > 0) {
          await Promise.all(ops);
        }
      },
    );
  }
}
