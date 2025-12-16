import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClassEntity } from './class.entity';
import { CreateClassDto, UpdateClassDto } from './dto/create-class.dto';

@Injectable()
export class ClassService {
  constructor(
    @InjectRepository(ClassEntity)
    private readonly classRepo: Repository<ClassEntity>,
  ) {}

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
      throw new NotFoundException(`Class with ID ${id} not found`);
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
