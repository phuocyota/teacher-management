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

@Injectable()
export class ClassService extends BaseService<ClassEntity> {
  constructor(
    @InjectRepository(ClassEntity)
    private readonly classRepo: Repository<ClassEntity>,
  ) {
    super(classRepo);
  }

  async create(data: CreateClassDto): Promise<ClassEntity> {
    const record = this.classRepo.create(data);
    return this.classRepo.save(record);
  }

  async findAll(): Promise<ClassEntity[]> {
    return this.classRepo.find();
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

  async remove(id: string): Promise<void> {
    const record = await this.findOne(id);
    await this.classRepo.remove(record);
  }
}
