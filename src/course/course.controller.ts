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
} from '@nestjs/swagger';
import { CourseService } from './course.service';
import { CreateCourseDto, UpdateCourseDto } from './dto/create-course.dto';
import {
  ClassOptionDto,
  CourseListResponseDto,
  CourseOptionListResponseDto,
  CourseOptionDto,
  CourseResponseDto,
  LectureOptionDto,
} from './dto/course.dto';
import { User } from 'src/common/decorator/user.decorator';
import type { JwtPayload } from 'src/common/interface/jwt-payload.interface';
import { PaginationResponseDto } from 'src/common/dto/pagination.dto';
import { MaxCodeResponseDto } from 'src/common/dto/base.dto';

@ApiTags('Course')
@ApiBearerAuth('access-token')
@Controller('courses')
export class CourseController {
  constructor(private readonly courseService: CourseService) {}

  @Post()
  @ApiCreatedResponse({ type: CourseResponseDto })
  create(@Body() dto: CreateCourseDto) {
    return this.courseService.create(dto);
  }

  @Get()
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'size', required: false, type: Number })
  @ApiQuery({
    name: 'q',
    required: false,
    type: String,
    description: 'Search by code or name',
  })
  @ApiQuery({
    name: 'classId',
    required: false,
    type: String,
    description: 'Filter courses by classId',
  })
  @ApiOkResponse({ type: CourseListResponseDto })
  findAll(
    @Query('page') page?: number,
    @Query('size') size?: number,
    @Query('q') q?: string,
    @Query('classId') classId?: string,
  ): Promise<PaginationResponseDto<CourseResponseDto>> {
    return this.courseService.findAll(page, size, q, classId);
  }

  @Get('max-code')
  @ApiOkResponse({ type: MaxCodeResponseDto })
  async getMaxCode(): Promise<MaxCodeResponseDto> {
    const maxCode = await this.courseService.getMaxCode();
    return { maxCode };
  }

  @Get('options')
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'size', required: false, type: Number })
  @ApiQuery({
    name: 'q',
    required: false,
    type: String,
    description: 'Search by course code, course name, class code or class name',
  })
  @ApiQuery({
    name: 'classId',
    required: false,
    type: String,
    description: 'Filter options by classId',
  })
  @ApiQuery({
    name: 'all',
    required: false,
    type: Boolean,
    description: 'Set true to return all courses without pagination',
  })
  @ApiOkResponse({ type: CourseOptionListResponseDto })
  getOptions(
    @Query('page') page?: number,
    @Query('size') size?: number,
    @Query('q') q?: string,
    @Query('classId') classId?: string,
    @Query('all') all?: string | boolean,
  ): Promise<
    PaginationResponseDto<CourseOptionDto> & {
      classes: ClassOptionDto[];
      courses: CourseOptionDto[];
      lectures: LectureOptionDto[];
    }
  > {
    return this.courseService.getOptions(
      page,
      size,
      q,
      classId,
      all === true || all === 'true',
    );
  }

  @Get(':id')
  @ApiOkResponse({ type: CourseResponseDto })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.courseService.findOne(id);
  }

  @Patch(':id')
  @ApiOkResponse({ type: CourseResponseDto })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCourseDto) {
    return this.courseService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @User() user: JwtPayload) {
    return this.courseService.remove(id, user);
  }
}
