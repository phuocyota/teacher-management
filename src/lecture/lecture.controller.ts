import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { LectureService } from './lecture.service';
import type { CreateLectureDto, UpdateLectureDto } from './dto/lecture.dto';
import { User } from 'src/common/decorator/user.decorator';
import { JwtPayload } from 'src/common/interface/jwt-payload.interface';

@ApiTags('Lecture')
@Controller('lecture')
export class LectureController {
  constructor(private readonly lectureService: LectureService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new lecture' })
  @ApiResponse({ status: 201, description: 'Lecture created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  create(@Body() dto: CreateLectureDto, @User() user: JwtPayload) {
    return this.lectureService.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'Get all lectures' })
  @ApiResponse({ status: 200, description: 'List of lectures' })
  findAll() {
    return this.lectureService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get lecture by ID' })
  @ApiResponse({ status: 200, description: 'Lecture found' })
  @ApiResponse({ status: 404, description: 'Lecture not found' })
  findOne(@Param('id') id: string) {
    return this.lectureService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update lecture' })
  @ApiResponse({ status: 200, description: 'Lecture updated successfully' })
  @ApiResponse({ status: 404, description: 'Lecture not found' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateLectureDto,
    @User() user: JwtPayload,
  ) {
    return this.lectureService.update(id, dto, user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete lecture' })
  @ApiResponse({ status: 200, description: 'Lecture deleted successfully' })
  @ApiResponse({ status: 404, description: 'Lecture not found' })
  remove(@Param('id') id: string, @User() user: JwtPayload) {
    return this.lectureService.delete(id, user);
  }
}
