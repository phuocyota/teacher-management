import { Injectable, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from './user.entity';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
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
   * Override create to handle password hashing and unique checks
   */
  async createUser(dto: CreateUserDto, currentUser?: JwtPayload) {
    // check unique userName/email
    const existing = await this.repo.findOne({
      where: [{ userName: dto.userName }, { email: dto.email }],
    });

    if (existing) {
      // determine conflict field
      if (existing.userName === dto.userName) {
        throw new ConflictException('userName already exists');
      }
      if (existing.email === dto.email) {
        throw new ConflictException('email already exists');
      }
      throw new ConflictException('User already exists');
    }

    const saltRounds = 10;
    const hashed = await bcrypt.hash(dto.password, saltRounds);

    const { password, ...rest } = dto;

    const newUser = this.repo.create({
      ...rest,
      hashPassword: hashed,
      createdBy: currentUser?.userId,
    });

    const saved = await this.repo.save(newUser);

    // sanitize response — remove hashed password before returning
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { hashPassword, ...sanitized } = saved as any;
    return sanitized as Partial<typeof saved>;
  }
}
