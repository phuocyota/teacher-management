import {
  Controller,
  Post,
  Body,
  BadRequestException,
  Headers,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { CreateUserDto } from 'src/user/dto/create.dto';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from 'src/common/decorator/public.decorator';
import { TokenCheckDto } from './dto/token-check.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login/admin')
  @ApiOperation({ summary: 'Admin login' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials or not an admin',
  })
  async loginAdmin(@Body() dto: LoginDto) {
    return this.authService.loginAdmin(dto);
  }

  @Public()
  @Post('login/teacher')
  @ApiOperation({ summary: 'Teacher login' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials or not a teacher',
  })
  async loginTeacher(@Body() dto: LoginDto) {
    return this.authService.loginTeacher(dto);
  }

  @Public()
  @Post('login/student')
  @ApiOperation({ summary: 'Student login' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials or not a student',
  })
  async loginStudent(@Body() dto: LoginDto) {
    return this.authService.loginStudent(dto);
  }

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'User registration' })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  async register(@Body() dto: CreateUserDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('token/check')
  @ApiOperation({ summary: 'Check token alive' })
  @ApiBearerAuth('access-token')
  @ApiResponse({ status: 200, description: 'Token status' })
  @ApiResponse({ status: 400, description: 'Missing token' })
  async checkToken(
    @Body() dto: TokenCheckDto,
    @Headers('authorization') authorization?: string,
  ) {
    const headerToken = authorization?.startsWith('Bearer ')
      ? authorization.replace('Bearer ', '')
      : undefined;
    const token = dto?.token || headerToken;
    if (!token) {
      throw new BadRequestException('Missing token');
    }
    return this.authService.isTokenAlive(token);
  }
}
