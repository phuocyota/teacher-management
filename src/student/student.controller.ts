import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseUUIDPipe,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiQuery,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiOperation,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { StudentService } from './student.service';
import { CreateStudentDto, UpdateStudentDto } from './dto/create-student.dto';
import { StudentResponseDto, StudentListResponseDto } from './dto/student.dto';
import { PaginationResponseDto } from 'src/common/dto/pagination.dto';
import { CreateStudentProfileDto } from './dto/create-student-profile.dto';

@ApiTags('Student')
@ApiBearerAuth('access-token')
@Controller('student')
export class StudentController {
  constructor(private readonly studentService: StudentService) {}

  @Post('profile')
  @ApiOperation({
    summary: 'Tạo học sinh từ ảnh, họ tên, schoolId, classId và số điện thoại',
  })
  @ApiCreatedResponse({ type: StudentResponseDto })
  @ApiBadRequestResponse({
    description: 'Du lieu ho so khong hop le hoac lop khong thuoc truong',
  })
  @ApiNotFoundResponse({ description: 'Khong tim thay truong hoac lop' })
  async createProfile(
    @Body(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    )
    dto: CreateStudentProfileDto,
  ) {
    return StudentResponseDto.fromEntity(
      await this.studentService.createProfile(dto),
    );
  }

  @Post()
  @ApiOperation({ summary: 'Tạo mới học sinh' })
  @ApiCreatedResponse({ type: StudentResponseDto })
  create(@Body() dto: CreateStudentDto) {
    return this.studentService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách học sinh' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'size', required: false, type: Number })
  @ApiQuery({
    name: 'studentGroupId',
    required: false,
    type: String,
    description: 'Lọc theo nhóm học sinh',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Tìm kiếm theo mã học sinh',
  })
  @ApiOkResponse({ type: StudentListResponseDto })
  findAll(
    @Query('page') page?: number,
    @Query('size') size?: number,
    @Query('studentGroupId') studentGroupId?: string,
    @Query('search') search?: string,
  ): Promise<PaginationResponseDto<StudentResponseDto>> {
    return this.studentService.findAll(page, size, studentGroupId, search);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy thông tin học sinh theo ID' })
  @ApiOkResponse({ type: StudentResponseDto })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return StudentResponseDto.fromEntity(await this.studentService.findOne(id));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật thông tin học sinh' })
  @ApiOkResponse({ type: StudentResponseDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStudentDto,
  ) {
    return this.studentService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa học sinh' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.studentService.remove(id);
  }
}
