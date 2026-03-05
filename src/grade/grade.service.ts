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

    if (shouldGetAllDetail) {
      const params: Array<string | number> = [];
      let whereClause = '';

      if (search) {
        params.push(`%${search}%`);
        whereClause = 'WHERE g.name ILIKE $1 OR g.code ILIKE $1';
      }

      const limitParamIndex = params.length + 1;
      params.push(size);
      const offsetParamIndex = params.length + 1;
      params.push(skip);

      const detailSql = `
        SELECT
          g.id AS "gradeId",
          g.name AS "gradeName",
          g.code AS "gradeCode",
          s.id AS "subjectId",
          s.name AS "subjectName",
          es.id AS "examSetId",
          es.name AS "examSetTitle",
          es.image as "examSetImage"
        FROM grade g
        INNER JOIN class c ON c.grade_id = g.id
        LEFT JOIN subject s ON s.id = c.subject_id
        LEFT JOIN exam_set es ON es.class_id = c.id
        ${whereClause}
        ORDER BY g.code ASC, s.name ASC, es.name ASC
        LIMIT $${limitParamIndex}
        OFFSET $${offsetParamIndex}
      `;

      let detailQueryString = detailSql;
      params.forEach((value, index) => {
        const placeholder = new RegExp(`\\$${index + 1}(?!\\d)`, 'g');
        let formattedValue = 'NULL';

        if (typeof value === 'string') {
          formattedValue = `'${value.replace(/'/g, "''")}'`;
        } else if (value !== null && value !== undefined) {
          formattedValue = String(value);
        }

        detailQueryString = detailQueryString.replace(
          placeholder,
          formattedValue,
        );
      });

      const rawDetails = await this.gradeRepo.query(detailSql, params as any[]);

      if (rawDetails.length === 0) {
        return {
          data: [],
          page,
          size,
          total: 0,
        };
      }

      const detailMap = new Map<string, GradeDetailResponseDto>();
      const orderedGradeIds: string[] = [];

      for (const row of rawDetails as Array<{
        gradeId: string;
        gradeName: string;
        gradeCode: string;
        subjectId: string | null;
        subjectName: string | null;
        examSetId: string | null;
        examSetTitle: string | null;
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
            examSets: [],
            total: 0,
          };
          gradeDetail.subjects.push(subject);
        }

        if (
          row.examSetId &&
          !subject.examSets.some((item) => item.id === row.examSetId)
        ) {
          subject.examSets.push({
            id: row.examSetId,
            title: row.examSetTitle ?? '',
          });
          subject.total = subject.examSets.length;
        }
      }

      const total = Number(0);

      return {
        data: orderedGradeIds
          .map((gradeId) => detailMap.get(gradeId))
          .filter((item): item is GradeDetailResponseDto => Boolean(item)),
        page,
        size,
        total,
      };
    }

    const qb = this.gradeRepo.createQueryBuilder('g');

    if (search) {
      qb.andWhere('g.name ILIKE :search OR g.code ILIKE :search', {
        search: `%${search}%`,
      });
    }

    qb.orderBy('g.code', 'ASC');
    qb.skip(skip).take(size);

    const [grades, total] = await qb.getManyAndCount();

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
