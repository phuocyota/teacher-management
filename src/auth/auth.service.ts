import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { CardLoginDto, LoginDto } from './dto/login.dto';
import { CreateUserDto } from 'src/user/dto/create.dto';
import { UserService } from 'src/user/user.service';
import { UserEntity } from 'src/user/user.entity';
import { UserType } from 'src/common/enum/user-type.enum';
import { ERROR_MESSAGES } from 'src/common/constant/error-messages.constant';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TokenEntity } from './token.entity';

@Injectable()
export class AuthService {
  private static readonly TOKEN_EXPIRES_IN_SECONDS = 31536000;

  constructor(
    private readonly userService: UserService,
    @InjectRepository(TokenEntity)
    private readonly tokenRepo: Repository<TokenEntity>,
  ) {}

  async validateUser(
    identifier: string,
    password: string,
  ): Promise<UserEntity | null> {
    const user = await this.userService.findByUsernameOrEmail(identifier);
    if (!user) return null;
    // Compare hashed password
    const match = await bcrypt.compare(password, user.hashPassword);
    if (!match) return null;

    return user;
  }

  private generateToken(user: UserEntity, deviceId: string): string {
    const payload = {
      userId: user.id,
      userType: user.userType,
      deviceId: deviceId,
    };

    const secret = process.env.JWT_SECRET || 'secretKey';
    // Token expires in 1 year (365 days) expressed in seconds
    return jwt.sign(payload, secret, {
      expiresIn: AuthService.TOKEN_EXPIRES_IN_SECONDS,
    });
  }

  private async saveToken(userId: string, token: string): Promise<void> {
    const expiredAt = new Date(
      Date.now() + AuthService.TOKEN_EXPIRES_IN_SECONDS * 1000,
    );
    const record = this.tokenRepo.create({
      token,
      userId,
      expiredAt,
    });
    await this.tokenRepo.save(record);
  }

  async isTokenAlive(
    token: string,
  ): Promise<{ alive: boolean; expiredAt?: Date }> {
    try {
      const secret = process.env.JWT_SECRET || 'secretKey';
      jwt.verify(token, secret);
    } catch {
      return { alive: false };
    }

    const record = await this.tokenRepo.findOne({ where: { token } });
    if (!record) {
      return { alive: false };
    }

    if (record.expiredAt <= new Date()) {
      await this.tokenRepo.delete({ id: record.id });
      return { alive: false, expiredAt: record.expiredAt };
    }

    return { alive: true, expiredAt: record.expiredAt };
  }

  async login(dto: LoginDto) {
    const user = await this.validateUser(dto.username, dto.password);
    if (!user) {
      throw new UnauthorizedException(ERROR_MESSAGES.INVALID_CREDENTIALS);
    }

    const token = this.generateToken(user, dto.deviceId);
    await this.saveToken(user.id, token);
    return {
      accessToken: token,
      userId: user.id,
      userType: user.userType,
      deviceId: dto.deviceId,
    };
  }

  async loginByCard(dto: CardLoginDto) {
    const cardId = dto.cardId?.trim();

    if (!cardId) {
      throw new BadRequestException('cardId khong duoc de trong');
    }

    const user = await this.userService.findByNfcId(cardId);
    if (!user) {
      throw new UnauthorizedException(ERROR_MESSAGES.INVALID_CREDENTIALS);
    }

    const token = this.generateToken(user, cardId);
    await this.saveToken(user.id, token);
    return {
      accessToken: token,
      userId: user.id,
      userType: user.userType,
      deviceId: cardId,
    };
  }

  /**
   * Login for Admin only
   */
  async loginAdmin(dto: LoginDto) {
    const user = await this.validateUser(dto.username, dto.password);
    if (!user) {
      throw new UnauthorizedException(ERROR_MESSAGES.INVALID_CREDENTIALS);
    }

    if (user.userType !== UserType.ADMIN) {
      throw new UnauthorizedException(ERROR_MESSAGES.ACCESS_DENIED_ADMIN);
    }

    const token = this.generateToken(user, dto.deviceId);
    await this.saveToken(user.id, token);
    return {
      accessToken: token,
      userId: user.id,
      userType: user.userType,
      deviceId: dto.deviceId,
    };
  }

  /**
   * Login for Teacher only
   */
  async loginTeacher(dto: LoginDto) {
    const user = await this.validateUser(dto.username, dto.password);
    if (!user) {
      throw new UnauthorizedException(ERROR_MESSAGES.INVALID_CREDENTIALS);
    }

    if (user.userType !== UserType.TEACHER) {
      throw new UnauthorizedException(ERROR_MESSAGES.ACCESS_DENIED_TEACHER);
    }

    const token = this.generateToken(user, dto.deviceId);
    await this.saveToken(user.id, token);
    return {
      accessToken: token,
      userId: user.id,
      userType: user.userType,
      deviceId: dto.deviceId,
    };
  }

  /**
   * Login for Student only
   */
  async loginStudent(dto: LoginDto) {
    const user = await this.validateUser(dto.username, dto.password);
    if (!user) {
      throw new UnauthorizedException(ERROR_MESSAGES.INVALID_CREDENTIALS);
    }

    if (user.userType !== UserType.STUDENT) {
      throw new UnauthorizedException(ERROR_MESSAGES.ACCESS_DENIED_STUDENT);
    }

    const token = this.generateToken(user, dto.deviceId);
    await this.saveToken(user.id, token);
    return {
      accessToken: token,
      userId: user.id,
      userType: user.userType,
      deviceId: dto.deviceId,
    };
  }

  /**
   * Register a new user. Password hashing is handled in UserService.createUser
   */
  register(dto: CreateUserDto) {
    return this.userService.createUser(dto);
  }
}
