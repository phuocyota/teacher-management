import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from './user.entity';
import { ChangePasswordDto, UserQueryDto } from './dto/user.dto';
import { CreateUserDto } from './dto/create.dto.js';
import { UpdateUserDto } from './dto/update.dto.js';
import { JwtPayload } from 'src/common/interface/jwt-payload.interface';
import { BaseService } from 'src/common/sql/base.service';

@Injectable()
export class UserService extends BaseService<UserEntity> {
  constructor(
    @InjectRepository(UserEntity)
    userRepo: Repository<UserEntity>,
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
        throw new ConflictException('Tên đăng nhập đã tồn tại');
      }
      if (existing.email === dto.email) {
        throw new ConflictException('Email đã tồn tại');
      }
      throw new ConflictException('Người dùng đã tồn tại');
    }

    const saltRounds = 10;
    const hash = await bcrypt.hash(dto.password, saltRounds);

    const newUser = this.repo.create({
      ...dto,
      createdBy: user?.userId,
      hashPassword: hash,
    });

    return await this.repo.save(newUser);
  }

  /**
   * Cập nhật user
   */
  async updateUser(id: string, dto: UpdateUserDto, user?: JwtPayload) {
    const existingUser = await this.repo.findOne({ where: { id } });

    if (!existingUser) {
      throw new NotFoundException('Không tìm thấy người dùng');
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
  ): Promise<{ message: string }> {
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
      throw new BadRequestException('Mật khẩu hiện tại không đúng');
    }

    const saltRounds = 10;
    const hash = await bcrypt.hash(dto.newPassword, saltRounds);

    existingUser.hashPassword = hash;
    existingUser.updatedBy = user?.userId;

    await this.repo.save(existingUser);

    return { message: 'Đổi mật khẩu thành công' };
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

    const whereConditions: any = {};

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
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    existingUser.isDisabled = !existingUser.isDisabled;
    existingUser.disabledAt = existingUser.isDisabled ? new Date() : undefined;
    existingUser.updatedBy = user?.userId;

    return await this.repo.save(existingUser);
  }
}
