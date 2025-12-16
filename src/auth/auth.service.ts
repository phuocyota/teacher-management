import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import { CreateUserDto } from 'src/user/dto/create.dto';
import { UserService } from 'src/user/user.service';
import { UserEntity } from 'src/user/user.entity';
import { UserType } from 'src/common/enum/user-type.enum';

@Injectable()
export class AuthService {
  constructor(private readonly userService: UserService) {}

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
    return jwt.sign(payload, secret, { expiresIn: '7d' });
  }

  async login(dto: LoginDto) {
    const user = await this.validateUser(dto.identifier, dto.password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const token = this.generateToken(user, dto.deviceId);
    return { accessToken: token };
  }

  /**
   * Login for Admin only
   */
  async loginAdmin(dto: LoginDto) {
    const user = await this.validateUser(dto.identifier, dto.password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.userType !== UserType.ADMIN) {
      throw new UnauthorizedException('Access denied. Admin only.');
    }

    const token = this.generateToken(user, dto.deviceId);
    return { accessToken: token };
  }

  /**
   * Login for Teacher only
   */
  async loginTeacher(dto: LoginDto) {
    const user = await this.validateUser(dto.identifier, dto.password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.userType !== UserType.TEACHER) {
      throw new UnauthorizedException('Access denied. Teacher only.');
    }

    const token = this.generateToken(user, dto.deviceId);
    return { accessToken: token };
  }

  /**
   * Register a new user. Password hashing is handled in UserService.createUser
   */
  register(dto: CreateUserDto) {
    return this.userService.createUser(dto);
  }
}
