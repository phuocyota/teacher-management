import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { UserService } from './user.service';
import { ChangePasswordDto, UserQueryDto } from './dto/user.dto';
import { CreateUserDto } from './dto/create.dto.js';
import { UpdateUserDto } from './dto/update.dto.js';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { User } from 'src/common/decorator/user.decorator';
import type { JwtPayload } from 'src/common/interface/jwt-payload.interface';

@ApiTags('User')
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @ApiOperation({ summary: 'Tạo người dùng mới' })
  @ApiResponse({ status: 201, description: 'Tạo thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiResponse({ status: 409, description: 'Trùng userName hoặc email' })
  create(@Body() dto: CreateUserDto, @User() user: JwtPayload) {
    return this.userService.createUser(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách người dùng có phân trang và filter' })
  @ApiResponse({ status: 200, description: 'Danh sách người dùng' })
  findAll(@Query() query: UserQueryDto) {
    return this.userService.findAllWithQuery(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy thông tin người dùng theo ID' })
  @ApiResponse({ status: 200, description: 'Thông tin người dùng' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.userService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Cập nhật thông tin người dùng' })
  @ApiResponse({ status: 200, description: 'Cập nhật thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy' })
  @ApiResponse({ status: 409, description: 'Email đã tồn tại' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @User() user: JwtPayload,
  ) {
    return this.userService.updateUser(id, dto, user);
  }

  @Patch(':id/password')
  @ApiOperation({ summary: 'Đổi mật khẩu' })
  @ApiResponse({ status: 200, description: 'Đổi mật khẩu thành công' })
  @ApiResponse({ status: 400, description: 'Mật khẩu hiện tại không đúng' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy' })
  changePassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangePasswordDto,
    @User() user: JwtPayload,
  ) {
    return this.userService.changePassword(id, dto, user);
  }

  @Patch(':id/toggle-disabled')
  @ApiOperation({ summary: 'Vô hiệu hóa/kích hoạt tài khoản' })
  @ApiResponse({ status: 200, description: 'Thao tác thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy' })
  toggleDisabled(
    @Param('id', ParseUUIDPipe) id: string,
    @User() user: JwtPayload,
  ) {
    return this.userService.toggleDisabled(id, user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa người dùng' })
  @ApiResponse({ status: 200, description: 'Xóa thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy' })
  delete(@Param('id', ParseUUIDPipe) id: string, @User() user: JwtPayload) {
    return this.userService.delete(id, user);
  }
}
