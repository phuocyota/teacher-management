import { Body, Controller, Post, Put } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { User } from 'src/common/decorator/user.decorator';
import type { JwtPayload } from 'src/common/interface/jwt-payload.interface';
import { LectureContextService } from 'src/lecture/services/lecture_context.service';
import {
  CreateLectureContextDto,
  UpdateLectureContextDto,
  BulkCreateLectureContextDto,
} from 'src/lecture/dto/lecture_context.dto';

@ApiTags('LectureContext')
@ApiBearerAuth('access-token')
@Controller('lecture/user')
export class LectureContextController {
  constructor(private readonly lectureContextService: LectureContextService) {}

  @Post()
  @ApiOperation({ summary: 'Add multiple users to a lecture' })
  @ApiResponse({ status: 201, description: 'Users added to lecture' })
  async addUsersToLecture(
    @Body() dto: CreateLectureContextDto,
    @User() user: JwtPayload,
  ): Promise<void> {
    await this.lectureContextService.create(dto, user);
  }

  @Put()
  @ApiOperation({ summary: 'Update multiple users of a lecture' })
  @ApiResponse({ status: 200, description: 'Users updated for lecture' })
  async updateUsersToLecture(
    @Body() dto: UpdateLectureContextDto,
    @User() user: JwtPayload,
  ): Promise<void> {
    await this.lectureContextService.update(dto, user);
  }

  @Post('bulk')
  @ApiOperation({
    summary: 'Bulk create: Add multiple users to multiple lectures',
  })
  @ApiResponse({
    status: 201,
    description: 'All lecture-user relations created successfully',
  })
  async bulkCreateLectureUsers(
    @Body() dto: BulkCreateLectureContextDto,
    @User() user: JwtPayload,
  ): Promise<void> {
    await this.lectureContextService.bulkCreate(dto, user);
  }
}
