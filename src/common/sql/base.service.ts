// import { NotFoundException } from '@nestjs/common';
import { ObjectLiteral, Repository } from 'typeorm';

export class BaseService<T extends ObjectLiteral> {
  constructor(protected readonly repo: Repository<T>) {}

  async findAll(): Promise<T[]> {
    return this.repo.find();
  }

  //   async findOne(id: any): Promise<T> {
  //     const item = await this.repo.findOne({
  //       where: { id }, // đúng chuẩn TypeORM
  //     });

  //     if (!item) {
  //       throw new NotFoundException('Item not found');
  //     }
  //     return item;
  //   }

  //   async create(dto: any): Promise<T> {
  //     const item = this.repo.create(dto);
  //     return this.repo.save(item);
  //   }

  //   async update(id: any, dto: any): Promise<T> {
  //     const item = await this.findOne(id);
  //     if (!item) throw new NotFoundException('Item not found');
  //     Object.assign(item, dto);
  //     return this.repo.save(item);
  //   }

  //   async delete(id: any): Promise<T> {
  //     const item = await this.findOne(id);
  //     await this.repo.remove(item);
  //     return item;
  //   }
}
