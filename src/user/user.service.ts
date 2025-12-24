import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { UserEntity } from './user.entity';
import { ChangePasswordDto, UserQueryDto } from './dto/user.dto';
import { CreateUserDto } from './dto/create.dto.js';
import { UpdateUserDto } from './dto/update.dto.js';
import { JwtPayload } from 'src/common/interface/jwt-payload.interface';
import { BaseService } from 'src/common/sql/base.service';
import { UserGroupService } from '../user-group/user-group.service';
import {
  ERROR_MESSAGES,
  ENTITY_NAMES,
} from 'src/common/constant/error-messages.constant';
import { runInTransaction } from 'src/common/database/transaction.utils';

@Injectable()
export class UserService extends BaseService<UserEntity> {
  constructor(
    @InjectRepository(UserEntity)
    userRepo: Repository<UserEntity>,
    private readonly userGroupService: UserGroupService,
    private readonly entityManager: EntityManager,
  ) {
    super(userRepo);
  }

  protected getEntityName(): string {
    return 'User';
  }

  public async findByUsernameOrEmail(
    identifier: string,
  ): Promise<UserEntity | null> {
    const user = await this.repo.findOne({
      where: [{ userName: identifier }, { email: identifier }],
    });

    return user ?? null;
  }

  /**   * Kiểm tra userName và email đã tồn tại chưa
   */
  private async checkUserExisting(dto: CreateUserDto): Promise<void> {
    const existing = await this.repo.findOne({
      where: [{ userName: dto.userName }, { email: dto.email }],
    });

    if (existing) {
      if (existing.userName === dto.userName) {
        throw new ConflictException(ERROR_MESSAGES.USERNAME_ALREADY_EXISTS);
      }
      if (existing.email === dto.email) {
        throw new ConflictException(ERROR_MESSAGES.EMAIL_ALREADY_EXISTS);
      }
      throw new ConflictException(ERROR_MESSAGES.USER_ALREADY_EXISTS);
    }
  }

  /**
   * Tạo user mới với hash password và kiểm tra unique
   */
  public async createUser(dto: CreateUserDto, user?: JwtPayload) {
    return runInTransaction(this.entityManager, async (manager) => {
      const userRepo = manager.getRepository(UserEntity);

      await this.checkUserExisting(dto);

      const saltRounds = 10;
      const hashPassword = await bcrypt.hash(dto.password, saltRounds);

      const savedUser = await userRepo.save(
        userRepo.create({
          ...dto,
          createdBy: user?.userId,
          hashPassword,
        }),
      );

      if (dto.groupIds?.length && user) {
        await this.userGroupService.addUserToGroups(
          dto.groupIds,
          savedUser.id,
          user?.userId,
          manager,
        );
      }

      return savedUser;
    });
  }

  /**   * Kiểm tra email đã tồn tại chưa
   */
  private async checkEmailExisting(email: string): Promise<void> {
    const existing = await this.repo.findOne({
      where: { email },
    });

    if (existing) {
      throw new ConflictException(ERROR_MESSAGES.EMAIL_ALREADY_EXISTS);
    }
  }

  /**
   * Cập nhật user
   */
  async updateUser(id: string, dto: UpdateUserDto, user?: JwtPayload) {
    return runInTransaction(this.entityManager, async (manager) => {
      const userRepo = manager.getRepository(UserEntity);

      const existingUser = await userRepo.findOne({ where: { id } });

      if (!existingUser) {
        throw new NotFoundException(
          ERROR_MESSAGES.NOT_FOUND(ENTITY_NAMES.USER),
        );
      }

      if (dto.email && dto.email !== existingUser.email) {
        await this.checkEmailExisting(dto.email);
      }

      // Handle disable / enable
      if (
        dto.isDisabled !== undefined &&
        dto.isDisabled !== existingUser.isDisabled
      ) {
        existingUser.isDisabled = dto.isDisabled;
        existingUser.disabledAt = dto.isDisabled ? new Date() : undefined;
      }

      Object.assign(existingUser, {
        ...dto,
        updatedBy: user?.userId,
      });

      if (dto.groupIds?.length && user) {
        await this.userGroupService.updateUserGroups(
          dto.groupIds,
          existingUser.id,
          user?.userId,
          manager,
        );
      }

      return userRepo.save(existingUser);
    });
  }

  /**
   * Đổi mật khẩu
   */
  async changePassword(
    id: string,
    dto: ChangePasswordDto,
    user?: JwtPayload,
  ): Promise<void> {
    const queryRunner = this.entityManager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const userRepo = queryRunner.manager.getRepository(UserEntity);
      const existingUser = await userRepo.findOne({ where: { id } });

      if (!existingUser) {
        throw new NotFoundException(
          ERROR_MESSAGES.NOT_FOUND(ENTITY_NAMES.USER),
        );
      }

      const isMatch = await bcrypt.compare(
        dto.currentPassword,
        existingUser.hashPassword,
      );

      if (!isMatch) {
        throw new BadRequestException(
          ERROR_MESSAGES.CURRENT_PASSWORD_INCORRECT,
        );
      }

      const saltRounds = 10;
      const hash = await bcrypt.hash(dto.newPassword, saltRounds);

      existingUser.hashPassword = hash;
      existingUser.updatedBy = user?.userId;

      await userRepo.save(existingUser);
      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Tìm kiếm và phân trang user
   */
  async findAllWithQuery(query: UserQueryDto) {
    const {
      page = 1,
      limit = 10,
      search,
      userType,
      status,
      isDisabled,
      groupId,
    } = query;

    const skip = (page - 1) * limit;

    const qb = this.repo.createQueryBuilder('user');

    /* =====================
     * CONDITIONAL JOIN
     * ===================== */
    if (groupId) {
      qb.innerJoin(
        'user_group',
        'ug',
        'ug.user_id = user.id AND ug.group_id = :groupId',
        { groupId },
      );
    }

    /* =====================
     * WHERE
     * ===================== */
    if (userType) {
      qb.andWhere('user.userType = :userType', { userType });
    }

    if (status) {
      qb.andWhere('user.status = :status', { status });
    }

    if (isDisabled !== undefined) {
      qb.andWhere('user.isDisabled = :isDisabled', { isDisabled });
    }

    /* =====================
     * SEARCH
     * ===================== */
    if (search) {
      qb.andWhere(
        `
      (
        user.fullName ILIKE :search
        OR user.email ILIKE :search
        OR user.userName ILIKE :search
      )
      `,
        { search: `%${search}%` },
      );
    }

    /* =====================
     * PAGINATION
     * ===================== */
    const [items, total] = await qb
      .orderBy('user.createdAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Cập nhật thời gian đăng nhập cuối
   */
  async updateLastLogin(id: string, ip?: string) {
    await this.repo.update(id, {
      lastLoginAt: new Date(),
      lastLoginIp: ip,
    });
  }

  /**
   * Vô hiệu hóa/kích hoạt tài khoản
   */
  async toggleDisabled(id: string, user?: JwtPayload) {
    const queryRunner = this.entityManager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const userRepo = queryRunner.manager.getRepository(UserEntity);
      const existingUser = await userRepo.findOne({ where: { id } });

      if (!existingUser) {
        throw new NotFoundException(
          ERROR_MESSAGES.NOT_FOUND(ENTITY_NAMES.USER),
        );
      }

      existingUser.isDisabled = !existingUser.isDisabled;
      existingUser.disabledAt = existingUser.isDisabled
        ? new Date()
        : undefined;
      existingUser.updatedBy = user?.userId;

      const result = await userRepo.save(existingUser);
      await queryRunner.commitTransaction();
      return result;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
