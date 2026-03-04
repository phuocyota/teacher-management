import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClassEntity } from './class.entity';
import { CreateClassDto, UpdateClassDto } from './dto/create-class.dto';
import {
  ERROR_MESSAGES,
  ENTITY_NAMES,
} from 'src/common/constant/error-messages.constant';
import { BaseService } from 'src/common/sql/base.service';
import { UploadService } from 'src/upload/upload.service';
import { JwtPayload } from 'src/common/interface/jwt-payload.interface';
import { UserType } from 'src/common/enum/user-type.enum';

@Injectable()
export class ClassService extends BaseService<ClassEntity> {
  constructor(
    @InjectRepository(ClassEntity)
    private readonly classRepo: Repository<ClassEntity>,
    private readonly uploadService: UploadService,
  ) {
    super(classRepo);
  }

  async create(data: CreateClassDto): Promise<ClassEntity> {
    const record = this.classRepo.create(data);
    return this.classRepo.save(record);
  }

  async findAll(user?: JwtPayload): Promise<ClassEntity[]> {
    if (!user || user.userType !== UserType.TEACHER) {
      return this.classRepo.find({ order: { name: 'ASC' } });
    }

    const records = await this.classRepo.query(
      `
      SELECT
        cl.id AS "id",
        cl.created_at AS "createdAt",
        cl.updated_at AS "updatedAt",
        cl.updated_by AS "updatedBy",
        cl.created_by AS "createdBy",
        cl.code AS "code",
        cl.name AS "name",
        cl.order_number AS "orderNumber",
        cl.display_type AS "displayType",
        cl.current_image AS "currentImage",
        cl.note AS "note",
        cl.grade_id AS "gradeId",
        cl.subject_id AS "subjectId"
      FROM class cl
      INNER JOIN course c ON cl.id = c.class_id
      INNER JOIN lecture l ON l.course_id = c.id
      INNER JOIN lecture_group lg ON lg.lecture_id = l.id
      INNER JOIN user_group ug ON ug.group_id = lg.group_id
      WHERE ug.user_id = $1

      UNION

      SELECT
        cl.id AS "id",
        cl.created_at AS "createdAt",
        cl.updated_at AS "updatedAt",
        cl.updated_by AS "updatedBy",
        cl.created_by AS "createdBy",
        cl.code AS "code",
        cl.name AS "name",
        cl.order_number AS "orderNumber",
        cl.display_type AS "displayType",
        cl.current_image AS "currentImage",
        cl.note AS "note",
        cl.grade_id AS "gradeId",
        cl.subject_id AS "subjectId"
      FROM class cl
      INNER JOIN course c ON cl.id = c.class_id
      INNER JOIN lecture l ON l.course_id = c.id
      INNER JOIN lecture_user lu ON lu.lecture_id = l.id
      WHERE lu.user_id = $1
      ORDER BY "name" ASC
      `,
      [user.userId],
    );

    return records as ClassEntity[];
  }

  async findOne(id: string): Promise<ClassEntity> {
    const record = await this.classRepo.findOne({ where: { id } });
    if (!record) {
      throw new NotFoundException(
        ERROR_MESSAGES.NOT_FOUND_WITH_ID(ENTITY_NAMES.CLASS, id),
      );
    }
    return record;
  }

  async update(id: string, data: UpdateClassDto): Promise<ClassEntity> {
    const record = await this.findOne(id);
    const updated = Object.assign(record, data);
    return this.classRepo.save(updated);
  }

  async remove(id: string, user: JwtPayload): Promise<void> {
    const record = await this.findOne(id);
    if (record.currentImage) {
      await this.uploadService.deleteFileByPath(record.currentImage);
    }
    await this.classRepo.remove(record);
  }

  async getMaxCode(): Promise<number> {
    const result = await this.classRepo
      .createQueryBuilder('class')
      .select(
        "MAX(CASE WHEN regexp_replace(class.code, '\\D', '', 'g') = '' THEN 0 ELSE (regexp_replace(class.code, '\\D', '', 'g'))::int END)",
        'maxCode',
      )
      .getRawOne<{ maxCode: number | null }>();

    return result?.maxCode ?? 0;
  }
}
