import { NotFoundException } from '@nestjs/common';
import { DeepPartial, FindOptionsWhere, Not, Repository } from 'typeorm';
import { JwtPayload } from '../interface/jwt-payload.interface';
import { BaseEntity } from './base.entity';
import { Status } from '../enum/status.enum';

export abstract class BaseService<T extends BaseEntity> {
  constructor(protected readonly repo: Repository<T>) {}

  async findAll(): Promise<T[]> {
    return this.repo.find({
      where: { status: Not(Status.DELETED) } as FindOptionsWhere<T>,
    });
  }

  async findOne(id: string): Promise<T> {
    const item = await this.repo.findOne({
      where: {
        id,
        status: Not(Status.DELETED),
      } as FindOptionsWhere<T>,
    });

    if (!item) {
      throw new NotFoundException(`${this.getEntityName()} not found`);
    }
    return item;
  }

  async create(dto: DeepPartial<T>, user: JwtPayload): Promise<T> {
    const item = this.repo.create({
      ...dto,
      createdBy: user.userId,
      status: Status.ACTIVE,
    } as DeepPartial<T>);
    return this.repo.save(item);
  }

  async update(id: string, dto: DeepPartial<T>, user: JwtPayload): Promise<T> {
    const item = await this.findOne(id);
    Object.assign(item, dto, { updatedBy: user.userId });
    return this.repo.save(item);
  }

  /**
   * Soft delete - chuyển status sang DELETED thay vì xóa thực sự
   */
  async delete(id: string, user: JwtPayload): Promise<T> {
    const item = await this.findOne(id);
    item.status = Status.DELETED;
    item.updatedBy = user.userId;
    return this.repo.save(item);
  }

  /**
   * Hard delete - xóa thực sự khỏi database
   */
  async hardDelete(id: string, user: JwtPayload): Promise<T> {
    const item = await this.repo.findOne({
      where: { id } as FindOptionsWhere<T>,
    });
    if (!item) {
      throw new NotFoundException(`${this.getEntityName()} not found`);
    }
    await this.repo.remove(item);
    return item;
  }

  /**
   * Override this method to customize entity name in error messages
   */
  protected getEntityName(): string {
    return 'Item';
  }
}
