import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ZoneEntity } from './zone.entity';
import { CreateZoneDto, UpdateZoneDto } from './dto/create-zone.dto';
import {
  ERROR_MESSAGES,
  ENTITY_NAMES,
} from 'src/common/constant/error-messages.constant';
import { PaginationResponseDto } from 'src/common/dto/pagination.dto';
import { ZoneDetailResponseDto, ZoneResponseDto } from './dto/zone.dto';
import { autoMapListToDto } from 'src/common/utils/auto-map.util';
import { JwtPayload } from 'src/common/interface/jwt-payload.interface';
import { UserType } from 'src/common/enum/user-type.enum';
import { GroupMemberRole } from 'src/user-group/enum/group-member-role.enum';

@Injectable()
export class ZoneService {
  constructor(
    @InjectRepository(ZoneEntity)
    private readonly zoneRepo: Repository<ZoneEntity>,
  ) {}

  async create(dto: CreateZoneDto): Promise<ZoneEntity> {
    const existingZone = await this.zoneRepo.findOne({
      where: { code: dto.code },
    });

    if (existingZone) {
      throw new ConflictException('Ma khu vuc da ton tai');
    }

    const record = this.zoneRepo.create({
      code: dto.code,
      name: dto.name,
    });
    return this.zoneRepo.save(record);
  }

  async findAll(
    page = 1,
    size = 10,
    search?: string,
    isGetAllDetail?: boolean | string,
    user?: JwtPayload,
  ): Promise<PaginationResponseDto<ZoneResponseDto | ZoneDetailResponseDto>> {
    const pageNumber = Number(page) || 1;
    const sizeNumber = Number(size) || 10;
    const skip = (pageNumber - 1) * sizeNumber;
    const shouldGetAllDetail =
      isGetAllDetail === true ||
      isGetAllDetail === 'true' ||
      isGetAllDetail === '1';

    if (shouldGetAllDetail) {
      return this.findAllDetail(pageNumber, sizeNumber, skip, search, user);
    }

    const qb = this.zoneRepo.createQueryBuilder('zone');

    if (search) {
      qb.andWhere('(zone.name ILIKE :search OR zone.code ILIKE :search)', {
        search: `%${search}%`,
      });
    }

    qb.orderBy('zone.createdAt', 'DESC');
    qb.skip(skip).take(sizeNumber);

    const [data, total] = await qb.getManyAndCount();

    return {
      data: autoMapListToDto(ZoneResponseDto, data),
      page: pageNumber,
      size: sizeNumber,
      total,
    };
  }

  private async findAllDetail(
    page: number,
    size: number,
    skip: number,
    search?: string,
    user?: JwtPayload,
  ): Promise<PaginationResponseDto<ZoneDetailResponseDto>> {
    const params: Array<string | number> = [];
    const whereConditions: string[] = [];

    if (search) {
      params.push(`%${search}%`);
      whereConditions.push(
        `(z.name ILIKE $${params.length} OR z.code ILIKE $${params.length})`,
      );
    }

    const isTeacher = user?.userType === UserType.TEACHER;
    let teacherZoneCondition = '';
    let teacherSchoolJoinCondition = '';
    let teacherStudentGroupJoinCondition = '';

    if (isTeacher) {
      params.push(user.userId);
      const teacherUserParamIndex = params.length;
      params.push(GroupMemberRole.LEADER);
      const leaderRoleParamIndex = params.length;

      teacherZoneCondition = `
        EXISTS (
          SELECT 1
          FROM school teacher_school
          WHERE teacher_school.zone_id = z.id
            AND (
              teacher_school.principal_user_id = $${teacherUserParamIndex}
              OR EXISTS (
                SELECT 1
                FROM student_group teacher_sg
                INNER JOIN student_group_member teacher_sgm
                  ON teacher_sgm.student_group_id = teacher_sg.id
                WHERE teacher_sg."schoolId" = teacher_school.id
                  AND teacher_sgm.user_id = $${teacherUserParamIndex}
                  AND teacher_sgm.role = $${leaderRoleParamIndex}
              )
            )
        )
      `;
      whereConditions.push(teacherZoneCondition);

      teacherSchoolJoinCondition = `
        AND (
          s.principal_user_id = $${teacherUserParamIndex}
          OR EXISTS (
            SELECT 1
            FROM student_group teacher_sg
            INNER JOIN student_group_member teacher_sgm
              ON teacher_sgm.student_group_id = teacher_sg.id
            WHERE teacher_sg."schoolId" = s.id
              AND teacher_sgm.user_id = $${teacherUserParamIndex}
              AND teacher_sgm.role = $${leaderRoleParamIndex}
          )
        )
      `;

      teacherStudentGroupJoinCondition = `
        AND (
          s.principal_user_id = $${teacherUserParamIndex}
          OR EXISTS (
            SELECT 1
            FROM student_group_member teacher_sgm
            WHERE teacher_sgm.student_group_id = sg.id
              AND teacher_sgm.user_id = $${teacherUserParamIndex}
              AND teacher_sgm.role = $${leaderRoleParamIndex}
          )
        )
      `;
    }

    const whereClause =
      whereConditions.length > 0
        ? `WHERE ${whereConditions.join(' AND ')}`
        : '';

    const limitParamIndex = params.length + 1;
    params.push(size);
    const offsetParamIndex = params.length + 1;
    params.push(skip);

    const detailSql = `
      WITH paged_zones AS (
        SELECT
          z.id,
          z.name,
          z.code,
          z.created_at,
          COUNT(*) OVER()::int AS total
        FROM zone z
        ${whereClause}
        ORDER BY z.created_at DESC
        LIMIT $${limitParamIndex}
        OFFSET $${offsetParamIndex}
      )
      SELECT
        pz.id AS "zoneId",
        pz.name AS "zoneName",
        pz.code AS "zoneCode",
        pz.total AS "total",
        s.id AS "schoolId",
        s.name AS "schoolName",
        s.code AS "schoolCode",
        sg.id AS "studentGroupId",
        sg.name AS "studentGroupName",
        sg.code AS "studentGroupCode"
      FROM paged_zones pz
      LEFT JOIN school s
        ON s.zone_id = pz.id
        ${teacherSchoolJoinCondition}
      LEFT JOIN student_group sg
        ON sg."schoolId" = s.id
        ${teacherStudentGroupJoinCondition}
      ORDER BY
        pz.created_at DESC,
        s.name ASC,
        sg.name ASC
    `;

    const rawDetails = await this.zoneRepo.query(detailSql, params as any[]);

    const detailMap = new Map<string, ZoneDetailResponseDto>();
    const orderedZoneIds: string[] = [];
    let total = 0;

    for (const row of rawDetails as Array<{
      zoneId: string;
      zoneName: string;
      zoneCode: string;
      total: number;
      schoolId: string | null;
      schoolName: string | null;
      schoolCode: string | null;
      studentGroupId: string | null;
      studentGroupName: string | null;
      studentGroupCode: number | null;
    }>) {
      total = Number(row.total ?? total);

      if (!detailMap.has(row.zoneId)) {
        detailMap.set(row.zoneId, {
          zone: {
            id: row.zoneId,
            name: row.zoneName,
            code: row.zoneCode,
          },
          schools: [],
        });
        orderedZoneIds.push(row.zoneId);
      }

      const zoneDetail = detailMap.get(row.zoneId)!;

      if (!row.schoolId || !row.schoolName) {
        continue;
      }

      let school = zoneDetail.schools.find(
        (item) => item.id === row.schoolId,
      );

      if (!school) {
        school = {
          id: row.schoolId,
          name: row.schoolName,
          code: row.schoolCode ?? '',
          studentGroups: [],
        };
        zoneDetail.schools.push(school);
      }

      if (!row.studentGroupId || !row.studentGroupName) {
        continue;
      }

      let studentGroup = school.studentGroups.find(
        (item) => item.id === row.studentGroupId,
      );

      if (!studentGroup) {
        studentGroup = {
          id: row.studentGroupId,
          name: row.studentGroupName,
          code: row.studentGroupCode ?? '',
        };
        school.studentGroups.push(studentGroup);
      }
    }

    return {
      data: orderedZoneIds
        .map((zoneId) => detailMap.get(zoneId))
        .filter((item): item is ZoneDetailResponseDto => Boolean(item)),
      page,
      size,
      total,
    };
  }

  async findOne(id: string): Promise<ZoneEntity> {
    const record = await this.zoneRepo.findOne({ where: { id } });

    if (!record) {
      throw new NotFoundException(
        ERROR_MESSAGES.NOT_FOUND_WITH_ID(ENTITY_NAMES.ZONE ?? 'Khu vuc', id),
      );
    }

    return record;
  }

  async update(id: string, dto: UpdateZoneDto): Promise<ZoneEntity> {
    const record = await this.findOne(id);

    if (dto.code !== undefined && dto.code !== record.code) {
      const existingZone = await this.zoneRepo.findOne({
        where: { code: dto.code },
      });

      if (existingZone) {
        throw new ConflictException('Ma khu vuc da ton tai');
      }

      record.code = dto.code;
    }

    if (dto.name !== undefined) {
      record.name = dto.name;
    }

    return this.zoneRepo.save(record);
  }

  async remove(id: string): Promise<void> {
    const record = await this.findOne(id);
    await this.zoneRepo.remove(record);
  }
}
