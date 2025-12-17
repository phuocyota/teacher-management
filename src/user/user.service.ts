import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import bcrypt from 'bcrypt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

@Injectable()
export class UserService extends BaseService<UserEntity> {
  constructor(
    @InjectRepository(UserEntity)
    userRepo: Repository<UserEntity>,
    private readonly userGroupService: UserGroupService,
  ) {
    super(userRepo);
  }

  protected getEntityName(): string {
    return 'User';
  }

  async findByUsernameOrEmail(identifier: string): Promise<UserEntity | null> {
    const user = await this.repo.findOne({
      where: [{ userName: identifier }, { email: identifier }],
    });

    return user ?? null;
  }

  /**
   * Tạo user mới với hash password và kiểm tra unique
   */
  async createUser(dto: CreateUserDto, user?: JwtPayload) {
    // Kiểm tra unique userName/email
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

    const saltRounds = 10;
    const hash = await bcrypt.hash(dto.password, saltRounds);

    const newUser = this.repo.create({
      ...dto,
      createdBy: user?.userId,
      hashPassword: hash,
    });

    const savedUser = await this.repo.save(newUser);

    // Nếu có groupIds, thêm user vào các groups
    if (dto.groupIds && dto.groupIds.length > 0 && user) {
      const groupIds = [...dto.groupIds];
      while (groupIds.length > 0) {
        const gid = groupIds.pop()!;
        await this.userGroupService.addUsersToGroup(gid, [savedUser.id], user);
      }
    }

    return savedUser;
  }

  /**
   * Cập nhật user
   */
  async updateUser(id: string, dto: UpdateUserDto, user?: JwtPayload) {
    const existingUser = await this.repo.findOne({ where: { id } });

    if (!existingUser) {
      throw new NotFoundException(ERROR_MESSAGES.NOT_FOUND(ENTITY_NAMES.USER));
    }

    // Kiểm tra email unique nếu có thay đổi
    if (dto.email && dto.email !== existingUser.email) {
      const emailExists = await this.repo.findOne({
        where: { email: dto.email },
      });
      if (emailExists) {
        throw new ConflictException('Email đã tồn tại');
      }
    }

    // Xử lý vô hiệu hóa tài khoản
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

    return await this.repo.save(existingUser);
  }

  /**
   * Đổi mật khẩu
   */
  async changePassword(
    id: string,
    dto: ChangePasswordDto,
    user?: JwtPayload,
  ): Promise<void> {
    const existingUser = await this.repo.findOne({ where: { id } });

    if (!existingUser) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    // Kiểm tra mật khẩu hiện tại
    const isMatch = await bcrypt.compare(
      dto.currentPassword,
      existingUser.hashPassword,
    );

    if (!isMatch) {
      throw new BadRequestException(ERROR_MESSAGES.CURRENT_PASSWORD_INCORRECT);
    }

    const saltRounds = 10;
    const hash = await bcrypt.hash(dto.newPassword, saltRounds);

    existingUser.hashPassword = hash;
    existingUser.updatedBy = user?.userId;

    await this.repo.save(existingUser);
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
    } = query;
    const skip = (page - 1) * limit;

    const whereConditions: Record<string, unknown> = {};

    if (userType) {
      whereConditions.userType = userType;
    }

    if (status) {
      whereConditions.status = status;
    }

    if (isDisabled !== undefined) {
      whereConditions.isDisabled = isDisabled;
    }

    const queryBuilder = this.repo.createQueryBuilder('user');

    // Áp dụng điều kiện where
    if (Object.keys(whereConditions).length > 0) {
      Object.entries(whereConditions).forEach(([key, value]) => {
        queryBuilder.andWhere(`user.${key} = :${key}`, { [key]: value });
      });
    }

    // Tìm kiếm theo tên hoặc email
    if (search) {
      queryBuilder.andWhere(
        '(user.fullName ILIKE :search OR user.email ILIKE :search OR user.userName ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    const [items, total] = await queryBuilder
      .skip(skip)
      .take(limit)
      .orderBy('user.createdAt', 'DESC')
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
    const existingUser = await this.repo.findOne({ where: { id } });

    if (!existingUser) {
      throw new NotFoundException(ERROR_MESSAGES.NOT_FOUND(ENTITY_NAMES.USER));
    }

    existingUser.isDisabled = !existingUser.isDisabled;
    existingUser.disabledAt = existingUser.isDisabled ? new Date() : undefined;
    existingUser.updatedBy = user?.userId;

    return await this.repo.save(existingUser);
  }
}
