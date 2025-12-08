import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LicenseEntity } from './license.entity';
import { BaseService } from 'src/common/sql/base.service';

@Injectable()
export class LicenseService extends BaseService<LicenseEntity> {
  constructor(
    @InjectRepository(LicenseEntity)
    repo: Repository<LicenseEntity>,
  ) {
    super(repo);
  }

  protected getEntityName(): string {
    return 'License';
  }
}
