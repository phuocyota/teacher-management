import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LectureContextEntity } from '../entity/lecture_context.entity';
import { runInTransaction } from 'src/common/database/transaction.utils';
import { BulkCreateLectureContextDto } from '../dto/lecture_context.dto';
import { JwtPayload } from 'src/common/interface/jwt-payload.interface';

@Injectable()
export class LectureContextService {
  constructor(
    @InjectRepository(LectureContextEntity)
    private readonly lectureContextRepository: Repository<LectureContextEntity>,
  ) {}

  // Bulk create: tạo records cho nhiều lectures và nhiều groups
  async bulkCreate(
    dto: BulkCreateLectureContextDto,
    user: JwtPayload,
  ): Promise<void> {
    return runInTransaction(
      this.lectureContextRepository.manager,
      async (manager) => {
        const repo = manager.getRepository(LectureContextEntity);
        const entities: LectureContextEntity[] = [];

        // Tạo cartesian product: mỗi lecture với mỗi group
        for (const lectureId of dto.lectureIds) {
          for (const groupId of dto.groupIds) {
            const entity = new LectureContextEntity();
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
