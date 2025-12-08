import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import { CreateUserDto } from 'src/user/dto/user.dto';
import { UserService } from 'src/user/user.service';
import { UserEntity } from 'src/user/user.entity';

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

  async login(dto: LoginDto) {
    const user = await this.validateUser(dto.identifier, dto.password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = {
      userId: user.id,
      userType: user.userType,
      deviceId: dto.deviceId,
    };

    const secret = process.env.JWT_SECRET || 'secretKey';
    const token = jwt.sign(payload, secret, { expiresIn: '7d' });

    return { accessToken: token };
  }

  /**
   * Register a new user. Password hashing is handled in UserService.createUser
   */
  async register(dto: CreateUserDto) {
    return this.userService.createUser(dto);
  }
}
