import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { LectureService } from './services/lecture.service';
import {
  CreateLectureDto,
  GetAllLectureDto,
  UpdateLectureDto,
} from './dto/lecture.request.dto';
import {
  LectureResponse,
  LectureResponseDto,
} from './dto/lecture.response.dto';
import { User } from 'src/common/decorator/user.decorator';
import type { JwtPayload } from 'src/common/interface/jwt-payload.interface';
import { PaginationResponseDto } from 'src/common/dto/pagingation.dto';

@ApiTags('Lecture')
@ApiBearerAuth('access-token')
@Controller('lecture')
export class LectureController {
  constructor(private readonly lectureService: LectureService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new lecture' })
  @ApiResponse({
    status: 201,
    description: 'Lecture created successfully',
    type: LectureResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  create(
    @Body() dto: CreateLectureDto,
    @User() user: JwtPayload,
  ): Promise<LectureResponseDto> {
    return this.lectureService.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'Get all lectures' })
  @ApiResponse({
    status: 200,
    description: 'List of lectures',
    type: PaginationResponseDto<LectureResponse>,
  })
  findAll(
    @Query() dto: GetAllLectureDto,
  ): Promise<PaginationResponseDto<LectureResponse>> {
    return this.lectureService.findAll(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get lecture by ID' })
  @ApiResponse({
    status: 200,
    description: 'Lecture found',
    type: LectureResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Lecture not found' })
  findOne(@Param('id') id: string): Promise<LectureResponseDto> {
    return this.lectureService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update lecture' })
  @ApiResponse({
    status: 200,
    description: 'Lecture updated successfully',
    type: LectureResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Lecture not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateLectureDto,
    @User() user: JwtPayload,
  ): Promise<LectureResponseDto> {
    return this.lectureService.update(id, dto, user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete lecture' })
  @ApiResponse({ status: 200, description: 'Lecture deleted successfully' })
  @ApiResponse({ status: 404, description: 'Lecture not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  remove(@Param('id') id: string, @User() user: JwtPayload): Promise<void> {
    return this.lectureService.remove(id, user);
  }
}
