import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SchoolEntity } from './school.entity';
import { CreateSchoolDto, UpdateSchoolDto } from './dto/create-school.dto';
import {
  ERROR_MESSAGES,
  ENTITY_NAMES,
} from 'src/common/constant/error-messages.constant';
import { PaginationResponseDto } from 'src/common/dto/pagination.dto';
import { SchoolResponseDto } from './dto/school.dto';
import { autoMapListToDto } from 'src/common/utils/auto-map.util';
import { ZoneService } from 'src/zone/zone.service';

@Injectable()
export class SchoolService {
  constructor(
    @InjectRepository(SchoolEntity)
    private readonly schoolRepo: Repository<SchoolEntity>,
    private readonly zoneService: ZoneService,
  ) {}

  async create(dto: CreateSchoolDto): Promise<SchoolEntity> {
    const existingSchool = await this.schoolRepo.findOne({
      where: { code: dto.code },
    });

    if (existingSchool) {
      throw new ConflictException('Mã trường học đã tồn tại');
    }

    const zone = dto.zoneId ? await this.zoneService.findOne(dto.zoneId) : null;

    const record = this.schoolRepo.create({
      code: dto.code,
      name: dto.name,
      zoneId: dto.zoneId ?? null,
      zone,
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
      .leftJoinAndSelect('school.zone', 'zone');

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
      relations: ['zone'],
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
      })),
    );
  }
}
