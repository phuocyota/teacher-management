import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { TeacherService } from './teacher.service';
import { CreateTeacherDto, UpdateTeacherDto } from './dto/teacher.dto';
import { User } from 'src/common/decorator/user.decorator';
import type { JwtPayload } from 'src/common/interface/jwt-payload.interface';

@ApiTags('Teacher')
@ApiBearerAuth('access-token')
@Controller('teacher')
export class TeacherController {
  constructor(private readonly teacherService: TeacherService) {}

  @Post()
  @ApiOperation({ summary: 'Tạo mới giáo viên' })
  @ApiResponse({ status: 201, description: 'Tạo giáo viên thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu đầu vào không hợp lệ' })
  create(@Body() dto: CreateTeacherDto, @User() user: JwtPayload) {
    return this.teacherService.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách giáo viên' })
  @ApiResponse({ status: 200, description: 'Danh sách giáo viên' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy giáo viên' })
  findAll() {
    return this.teacherService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy thông tin giáo viên theo ID' })
  @ApiResponse({ status: 200, description: 'Tìm thấy giáo viên' })
  @ApiResponse({ status: 404, description: 'Giáo viên không tồn tại' })
  findOne(@Param('id') id: string) {
    return this.teacherService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Cập nhật thông tin giáo viên' })
  @ApiResponse({ status: 200, description: 'Cập nhật giáo viên thành công' })
  @ApiResponse({ status: 404, description: 'Giáo viên không tồn tại' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTeacherDto,
    @User() user: JwtPayload,
  ) {
    return this.teacherService.update(id, dto, user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa giáo viên' })
  @ApiResponse({ status: 200, description: 'Xóa giáo viên thành công' })
  @ApiResponse({ status: 404, description: 'Giáo viên không tồn tại' })
  remove(@Param('id') id: string, @User() user: JwtPayload) {
    return this.teacherService.delete(id, user);
  }
}
