import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LicenseEntity } from './license.entity';
import { CreateLicenseDto, UpdateLicenseDto } from './dto/license.dto';

@Injectable()
export class LicenseService {
  constructor(
    @InjectRepository(LicenseEntity)
    private readonly repo: Repository<LicenseEntity>,
  ) {}

  findAll() {
    return this.repo.find();
  }

  async findOne(id: string) {
    const license = await this.repo.findOne({ where: { id } });
    if (!license) throw new NotFoundException('License not found');
    return license;
  }

  create(dto: CreateLicenseDto) {
    const license = this.repo.create(dto);
    return this.repo.save(license);
  }

  async update(id: string, dto: UpdateLicenseDto) {
    const license = await this.findOne(id);

    const updated = Object.assign(license, dto);

    return this.repo.save(updated);
  }

  async delete(id: string) {
    const license = await this.findOne(id);
    await this.repo.remove(license);
    return license;
  }
}