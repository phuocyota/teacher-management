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
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiQuery,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiOperation,
} from '@nestjs/swagger';
import { StudentGroupService } from './student-group.service';
import {
  CreateStudentGroupDto,
  UpdateStudentGroupDto,
} from './dto/create-student-group.dto';
import {
  StudentGroupResponseDto,
  StudentGroupListResponseDto,
} from './dto/student-group.dto';
import { PaginationResponseDto } from 'src/common/dto/pagination.dto';

@ApiTags('Student Group')
@ApiBearerAuth('access-token')
@Controller('student-group')
export class StudentGroupController {
  constructor(private readonly studentGroupService: StudentGroupService) {}

  @Post()
  @ApiOperation({ summary: 'Tạo mới nhóm học sinh' })
  @ApiCreatedResponse({ type: StudentGroupResponseDto })
  create(@Body() dto: CreateStudentGroupDto) {
    return this.studentGroupService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách nhóm học sinh' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'size', required: false, type: Number })
  @ApiQuery({
    name: 'schoolId',
    required: false,
    type: String,
    description: 'Lọc theo trường học',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Tìm kiếm theo tên nhóm',
  })
  @ApiOkResponse({ type: StudentGroupListResponseDto })
  findAll(
    @Query('page') page?: number,
    @Query('size') size?: number,
    @Query('schoolId') schoolId?: string,
    @Query('search') search?: string,
  ): Promise<PaginationResponseDto<StudentGroupResponseDto>> {
    return this.studentGroupService.findAll(page, size, schoolId, search);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy thông tin nhóm học sinh theo ID' })
  @ApiOkResponse({ type: StudentGroupResponseDto })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.studentGroupService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật thông tin nhóm học sinh' })
  @ApiOkResponse({ type: StudentGroupResponseDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStudentGroupDto,
  ) {
    return this.studentGroupService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa nhóm học sinh' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.studentGroupService.remove(id);
  }
}
