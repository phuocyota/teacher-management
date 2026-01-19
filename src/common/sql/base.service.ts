import { NotFoundException } from '@nestjs/common';
import {
  DeepPartial,
  EntityManager,
  FindOptionsWhere,
  In,
  Repository,
} from 'typeorm';
import { JwtPayload } from '../interface/jwt-payload.interface.js';
import { BaseEntity } from './base.entity.js';
import { ERROR_MESSAGES } from '../constant/error-messages.constant.js';

export abstract class BaseService<T extends BaseEntity> {
  constructor(protected readonly repo: Repository<T>) {}

  /**
   * Chạy một hàm trong transaction
   * Nếu chưa có transaction, tạo mới; nếu đã có, chỉ execute hàm
   */
  public async runInTransaction<R>(callback: () => Promise<R>): Promise<R> {
    // Lấy QueryRunner từ connection
    const queryRunner = this.repo.manager.connection.createQueryRunner();

    // Kết nối đến database
    await queryRunner.connect();

    // Bắt đầu transaction
    await queryRunner.startTransaction();

    try {
      // Thực thi callback
      const result = await callback();

      // Commit transaction nếu thành công
      await queryRunner.commitTransaction();

      return result;
    } catch (error) {
      // Rollback transaction nếu có lỗi
      await queryRunner.rollbackTransaction();

      // Ném lỗi ra ngoài
      throw error;
    } finally {
      // Giải phóng QueryRunner
      await queryRunner.release();
    }
  }

  async findAll(): Promise<T[]> {
    return this.repo.find();
  }

  async findById(id: string): Promise<T | null> {
    return this.repo.findOne({
      where: {
        id,
      } as FindOptionsWhere<T>,
    });
  }

  async findOne(id: string): Promise<T> {
    const item = await this.findById(id);

    if (!item) {
      throw new NotFoundException(
        ERROR_MESSAGES.NOT_FOUND(this.getEntityName()),
      );
    }
    return item;
  }

  async findByIds(ids: string[]): Promise<T[]> {
    const items = await this.repo.findBy({
      id: In(ids),
    } as FindOptionsWhere<T>);
    if (!items || items.length === 0) {
      throw new NotFoundException(
        ERROR_MESSAGES.NOT_FOUND(this.getEntityName()),
      );
    }
    return items;
  }

  async create(
    dto: DeepPartial<T>,
    user: JwtPayload,
    manager?: EntityManager,
  ): Promise<T> {
    const repo = manager ? manager.getRepository(this.repo.target) : this.repo;

    const item = repo.create({
      ...dto,
      createdBy: user.userId,
    });

    return repo.save(item);
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
    item.updatedBy = user.userId;
    return await this.repo.save(item);
  }

  /**
   * Hard delete - xóa thực sự khỏi database
   */
  async hardDelete(id: string): Promise<T> {
    const item = await this.repo.findOne({
      where: { id } as FindOptionsWhere<T>,
    });
    if (!item) {
      throw new NotFoundException(
        ERROR_MESSAGES.NOT_FOUND(this.getEntityName()),
      );
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
