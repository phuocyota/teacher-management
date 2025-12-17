import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { UserEntity } from './user.entity';
import { ERROR_MESSAGES } from 'src/common/constant/error-messages.constant';

/**
 * Service xử lý các thao tác với UserRepository
 */
@Injectable()
export class UserRepositoryService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  /**
   * Tìm user theo ID
   */
  async findOneById(userId: string): Promise<UserEntity | null> {
    return this.userRepo.findOne({ where: { id: userId } });
  }

  /**
   * Tìm nhiều users theo IDs
   */
  async findByIds(userIds: string[]): Promise<UserEntity[]> {
    return this.userRepo.find({
      where: { id: In(userIds) },
    });
  }

  /**
   * Kiểm tra user tồn tại
   */
  async validateUser(userId: string): Promise<void> {
    const user = await this.findOneById(userId);
    if (!user) {
      throw new NotFoundException(
        ERROR_MESSAGES.NOT_FOUND_WITH_ID('User', userId),
      );
    }
  }

  /**
   * Get repository để sử dụng transaction
   */
  getRepository(): Repository<UserEntity> {
    return this.userRepo;
  }
}
