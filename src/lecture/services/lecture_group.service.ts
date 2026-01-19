import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LectureGroupEntity } from '../entity/lecture_group.entity';
import { runInTransaction } from 'src/common/database/transaction.utils';
import { BulkCreateLectureGroupDto } from '../dto/lecture_group.dto';
import { JwtPayload } from 'src/common/interface/jwt-payload.interface';

@Injectable()
export class LectureGroupService {
  constructor(
    @InjectRepository(LectureGroupEntity)
    private readonly LectureGroupRepository: Repository<LectureGroupEntity>,
  ) {}

  // Bulk create: tạo records cho nhiều lectures và nhiều groups
  async bulkCreate(
    dto: BulkCreateLectureGroupDto,
    user: JwtPayload,
  ): Promise<void> {
    return runInTransaction(
      this.LectureGroupRepository.manager,
      async (manager) => {
        const repo = manager.getRepository(LectureGroupEntity);
        const entities: LectureGroupEntity[] = [];

        // Tạo cartesian product: mỗi lecture với mỗi group
        for (const lectureId of dto.lectureIds) {
          for (const groupId of dto.groupIds) {
            const entity = new LectureGroupEntity();
            entity.lectureId = lectureId;
            entity.groupId = groupId;
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
