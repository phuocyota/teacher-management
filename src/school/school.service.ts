import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SchoolEntity } from './school.entity';
import { UserEntity } from 'src/user/user.entity';
import { CreateSchoolDto, UpdateSchoolDto } from './dto/create-school.dto';
import {
  ERROR_MESSAGES,
  ENTITY_NAMES,
} from 'src/common/constant/error-messages.constant';
import { PaginationResponseDto } from 'src/common/dto/pagination.dto';
import { SchoolResponseDto } from './dto/school.dto';
import { autoMapListToDto } from 'src/common/utils/auto-map.util';
import { ZoneService } from 'src/zone/zone.service';
import { StudentGroupEntity } from 'src/student-group/student-group.entity';
import { StudentGroupResponseDto } from 'src/student-group/dto/student-group.dto';
import { GroupMemberRole } from 'src/user-group/enum/group-member-role.enum';

@Injectable()
export class SchoolService {
  constructor(
    @InjectRepository(SchoolEntity)
    private readonly schoolRepo: Repository<SchoolEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(StudentGroupEntity)
    private readonly studentGroupRepo: Repository<StudentGroupEntity>,
    private readonly zoneService: ZoneService,
  ) {}

  private async ensurePrincipalUserExists(
    principalUserId?: string | null,
  ): Promise<UserEntity | null> {
    if (!principalUserId) {
      return null;
    }

    const user = await this.userRepo.findOne({
      where: { id: principalUserId },
    });

    if (!user) {
      throw new NotFoundException(
        ERROR_MESSAGES.NOT_FOUND_WITH_ID(
          ENTITY_NAMES.USER ?? 'Người dùng',
          principalUserId,
        ),
      );
    }

    return user;
  }

  async create(dto: CreateSchoolDto): Promise<SchoolEntity> {
    const existingSchool = await this.schoolRepo.findOne({
      where: { code: dto.code },
    });

    if (existingSchool) {
      throw new ConflictException('Mã trường học đã tồn tại');
    }

    const zone = dto.zoneId ? await this.zoneService.findOne(dto.zoneId) : null;
    const principalUser = await this.ensurePrincipalUserExists(
      dto.principalUserId,
    );

    const record = this.schoolRepo.create({
      code: dto.code,
      name: dto.name,
      zoneId: dto.zoneId ?? null,
      zone,
      principalUserId: dto.principalUserId ?? null,
      principalUser,
      address: dto.address,
    });
    return this.schoolRepo.save(record);
  }

  async findAll(
    page = 1,
    size = 10,
    search?: string,
    code?: string,
    zoneId?: string,
  ): Promise<PaginationResponseDto<SchoolResponseDto>> {
    const skip = (page - 1) * size;

    const qb = this.schoolRepo
      .createQueryBuilder('school')
      .leftJoinAndSelect('school.zone', 'zone')
      .leftJoinAndSelect('school.principalUser', 'principalUser');

    if (search) {
      qb.andWhere('(school.name ILIKE :search OR school.code ILIKE :search)', {
        search: `%${search}%`,
      });
    }

    if (code) {
      qb.andWhere('school.code = :code', { code });
    }

    if (zoneId) {
      qb.andWhere('school.zoneId = :zoneId', { zoneId });
    }

    qb.orderBy('school.createdAt', 'DESC');
    qb.skip(skip).take(size);

    const [data, total] = await qb.getManyAndCount();

    return {
      data: this.mapSchoolsToResponse(data),
      page,
      size,
      total,
    };
  }

  async findOne(id: string): Promise<SchoolEntity> {
    const record = await this.schoolRepo.findOne({
      where: { id },
      relations: ['zone', 'principalUser'],
    });

    if (!record) {
      throw new NotFoundException(
        ERROR_MESSAGES.NOT_FOUND_WITH_ID(
          ENTITY_NAMES.SCHOOL ?? 'Trường học',
          id,
        ),
      );
    }

    return record;
  }

  async findStudentGroupsBySchool(
    schoolId: string,
    userId: string,
  ): Promise<StudentGroupResponseDto[]> {
    await this.findOne(schoolId);

    const studentGroups = await this.studentGroupRepo
      .createQueryBuilder('studentGroup')
      .innerJoin('studentGroup.school', 'school')
      .where('studentGroup.schoolId = :schoolId', { schoolId })
      .andWhere(
        `(
          school.principal_user_id = :userId
          OR EXISTS (
            SELECT 1
            FROM student_group_member studentGroupMember
            WHERE studentGroupMember.user_id = :userId
              AND studentGroupMember.role = :leaderRole
              AND studentGroupMember.student_group_id = "studentGroup".id
          )
        )`,
        {
          userId,
          leaderRole: GroupMemberRole.LEADER,
        },
      )
      .orderBy('studentGroup.code', 'ASC')
      .addOrderBy('studentGroup.name', 'ASC')
      .getMany();

    return autoMapListToDto(StudentGroupResponseDto, studentGroups);
  }

  async update(id: string, dto: UpdateSchoolDto): Promise<SchoolEntity> {
    const record = await this.findOne(id);

    if (dto.code !== undefined && dto.code !== record.code) {
      const existingSchool = await this.schoolRepo.findOne({
        where: { code: dto.code },
      });

      if (existingSchool) {
        throw new ConflictException('Mã trường học đã tồn tại');
      }
      record.code = dto.code;
    }

    if (dto.name !== undefined) {
      record.name = dto.name;
    }

    if (dto.zoneId !== undefined) {
      record.zone = dto.zoneId
        ? await this.zoneService.findOne(dto.zoneId)
        : null;
      record.zoneId = dto.zoneId ?? null;
    }

    if (dto.principalUserId !== undefined) {
      record.principalUser = await this.ensurePrincipalUserExists(
        dto.principalUserId,
      );
      record.principalUserId = dto.principalUserId ?? null;
    }

    if (dto.address !== undefined) {
      record.address = dto.address;
    }

    return this.schoolRepo.save(record);
  }

  async remove(id: string): Promise<void> {
    const record = await this.findOne(id);
    await this.schoolRepo.remove(record);
  }

  private mapSchoolsToResponse(schools: SchoolEntity[]): SchoolResponseDto[] {
    return autoMapListToDto(
      SchoolResponseDto,
      schools.map((school) => ({
        ...school,
        zoneName: school.zone?.name ?? null,
        principalUserName: school.principalUser?.fullName ?? null,
      })),
    );
  }
}
