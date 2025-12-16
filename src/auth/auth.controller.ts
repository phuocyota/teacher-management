import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { CreateUserDto } from 'src/user/dto/create.dto';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from 'src/common/decorator/public.decorator';

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
  @Post('register')
  @ApiOperation({ summary: 'User registration' })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  async register(@Body() dto: CreateUserDto) {
    return this.authService.register(dto);
  }
}
