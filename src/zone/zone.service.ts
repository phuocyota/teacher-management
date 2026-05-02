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
import { ZoneResponseDto } from './dto/zone.dto';
import { autoMapListToDto } from 'src/common/utils/auto-map.util';

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
  ): Promise<PaginationResponseDto<ZoneResponseDto>> {
    const skip = (page - 1) * size;

    const qb = this.zoneRepo.createQueryBuilder('zone');

    if (search) {
      qb.andWhere('(zone.name ILIKE :search OR zone.code ILIKE :search)', {
        search: `%${search}%`,
      });
    }

    qb.orderBy('zone.createdAt', 'DESC');
    qb.skip(skip).take(size);

    const [data, total] = await qb.getManyAndCount();

    return {
      data: autoMapListToDto(ZoneResponseDto, data),
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
