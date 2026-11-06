import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GradeEntity } from './grade.entity';
import { CreateGradeDto, UpdateGradeDto } from './dto/create-grade.dto';
import {
  ERROR_MESSAGES,
  ENTITY_NAMES,
} from 'src/common/constant/error-messages.constant';
import { PaginationResponseDto } from 'src/common/dto/pagination.dto';
import { GradeDetailResponseDto, GradeResponseDto } from './dto/grade.dto';
import { autoMapListToDto } from 'src/common/utils/auto-map.util';

@Injectable()
export class GradeService {
  constructor(
    @InjectRepository(GradeEntity)
    private readonly gradeRepo: Repository<GradeEntity>,
  ) {}

  async create(dto: CreateGradeDto): Promise<GradeEntity> {
    const record = this.gradeRepo.create({
      code: dto.code,
      name: dto.name,
    });
    return this.gradeRepo.save(record);
  }

  async findAll(
    page = 1,
    size = 100,
    search?: string,
    isGetAllDetail?: boolean | string,
  ): Promise<PaginationResponseDto<GradeResponseDto | GradeDetailResponseDto>> {
    const skip = (page - 1) * size;
    const shouldGetAllDetail =
      isGetAllDetail === true ||
      isGetAllDetail === 'true' ||
      isGetAllDetail === '1';
    const gradeOrder = `CASE
      WHEN g.code ~ '^K[0-9]+$' THEN substring(g.code from 2)::integer
      WHEN g.code = 'KM' THEN 13
      WHEN g.code = 'KC' THEN 14
      WHEN g.code = 'KL' THEN 15
      ELSE 16 END`;
    const qb = this.gradeRepo.createQueryBuilder('g');
    if (shouldGetAllDetail) {
      qb.andWhere(`EXISTS (
        SELECT 1 FROM class c
        INNER JOIN subject s ON s.id = c.subject_id
        WHERE c.grade_id = g.id
      )`);
    }
    if (search) {
      qb.andWhere('(g.name ILIKE :search OR g.code ILIKE :search)', {
        search: `%${search}%`,
      });
    }
    qb.orderBy(gradeOrder, 'ASC').addOrderBy('g.code', 'ASC');
    qb.skip(skip).take(size);
    const [grades, total] = await qb.getManyAndCount();

    if (shouldGetAllDetail) {
      if (grades.length === 0) {
        return { data: [], page, size, total };
      }

      const detailSql = `
        SELECT
          g.id AS "gradeId",
          g.name AS "gradeName",
          g.code AS "gradeCode",
          s.id AS "subjectId",
          s.name AS "subjectName",
          c.current_image AS "subjectImage",
          es.id AS "examSetId",
          es.name AS "examSetTitle",
          es.image as "examSetImage"
        FROM grade g
        LEFT JOIN class c ON c.grade_id = g.id
        LEFT JOIN subject s ON s.id = c.subject_id
        LEFT JOIN exam_set es ON es.class_id = c.id OR EXISTS (
          SELECT 1 FROM exam_set_class esc
          WHERE esc.class_id = c.id AND esc.exam_set_id = es.id
        )
        WHERE g.id = ANY($1::uuid[])
        ORDER BY ${gradeOrder}, g.code ASC, s.name ASC, es.name ASC,
          c.order_number ASC, c.id ASC, es.id ASC
      `;
      const rawDetails = await this.gradeRepo.query(detailSql, [
        grades.map((grade) => grade.id),
      ]);

      const detailMap = new Map<string, GradeDetailResponseDto>();
      const orderedGradeIds: string[] = [];

      for (const row of rawDetails as Array<{
        gradeId: string;
        gradeName: string;
        gradeCode: string;
        subjectId: string | null;
        subjectName: string | null;
        subjectImage: string | null;
        examSetId: string | null;
        examSetTitle: string | null;
        examSetImage: string | null;
      }>) {
        if (!detailMap.has(row.gradeId)) {
          detailMap.set(row.gradeId, {
            grade: {
              id: row.gradeId,
              name: row.gradeName,
            },
            subjects: [],
          });
          orderedGradeIds.push(row.gradeId);
        }

        if (!row.subjectId || !row.subjectName) {
          continue;
        }

        const gradeDetail = detailMap.get(row.gradeId)!;
        let subject = gradeDetail.subjects.find(
          (item) => item.id === row.subjectId,
        );

        if (!subject) {
          subject = {
            id: row.subjectId,
            name: row.subjectName,
            image: row.subjectImage ?? null,
            examSets: [],
            total: 0,
          };
          gradeDetail.subjects.push(subject);
        } else if (!subject.image && row.subjectImage) {
          subject.image = row.subjectImage;
        }

        if (
          row.examSetId &&
          !subject.examSets.some((item) => item.id === row.examSetId)
        ) {
          subject.examSets.push({
            id: row.examSetId,
            title: row.examSetTitle ?? '',
            image: row.examSetImage ?? null,
          });
          subject.total = subject.examSets.length;
        }
      }

      return {
        data: orderedGradeIds
          .map((gradeId) => detailMap.get(gradeId))
          .filter((item): item is GradeDetailResponseDto => Boolean(item)),
        page,
        size,
        total,
      };
    }

    return {
      data: autoMapListToDto(GradeResponseDto, grades),
      page,
      size,
      total,
    };
  }

  async findOne(id: string): Promise<GradeEntity> {
    const record = await this.gradeRepo.findOne({ where: { id } });
    if (!record) {
      throw new NotFoundException(
        ERROR_MESSAGES.NOT_FOUND_WITH_ID(ENTITY_NAMES.GRADE ?? 'Khoi', id),
      );
    }
    return record;
  }

  async update(id: string, dto: UpdateGradeDto): Promise<GradeEntity> {
    const record = await this.findOne(id);

    if (dto.code !== undefined) {
      record.code = dto.code;
    }

    if (dto.name !== undefined) {
      record.name = dto.name;
    }

    return this.gradeRepo.save(record);
  }

  async remove(id: string): Promise<void> {
    const record = await this.findOne(id);
    await this.gradeRepo.remove(record);
  }
}
