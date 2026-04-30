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
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { SchoolService } from './school.service';
import { CreateSchoolDto, UpdateSchoolDto } from './dto/create-school.dto';
import { SchoolResponseDto, SchoolListResponseDto } from './dto/school.dto';
import { PaginationResponseDto } from 'src/common/dto/pagination.dto';

@ApiTags('School')
@ApiBearerAuth('access-token')
@Controller('school')
export class SchoolController {
  constructor(private readonly schoolService: SchoolService) {}

  @Post()
  @ApiOperation({ summary: 'Tạo mới trường học' })
  @ApiCreatedResponse({ type: SchoolResponseDto })
  create(@Body() dto: CreateSchoolDto) {
    return this.schoolService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách trường học' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'size', required: false, type: Number })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Tìm kiếm theo tên hoặc mã trường',
  })
  @ApiQuery({
    name: 'code',
    required: false,
    type: String,
    description: 'Lọc theo mã trường',
  })
  @ApiQuery({
    name: 'zoneId',
    required: false,
    type: String,
    description: 'Lọc theo khu vực',
  })
  @ApiOkResponse({ type: SchoolListResponseDto })
  findAll(
    @Query('page') page?: number,
    @Query('size') size?: number,
    @Query('search') search?: string,
    @Query('code') code?: string,
    @Query('zoneId') zoneId?: string,
  ): Promise<PaginationResponseDto<SchoolResponseDto>> {
    return this.schoolService.findAll(page, size, search, code, zoneId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy thông tin trường học theo ID' })
  @ApiOkResponse({ type: SchoolResponseDto })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.schoolService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật thông tin trường học' })
  @ApiOkResponse({ type: SchoolResponseDto })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSchoolDto) {
    return this.schoolService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa trường học' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.schoolService.remove(id);
  }
}
