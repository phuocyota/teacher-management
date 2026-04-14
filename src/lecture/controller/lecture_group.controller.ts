import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { User } from 'src/common/decorator/user.decorator';
import type { JwtPayload } from 'src/common/interface/jwt-payload.interface';
import { LectureGroupService } from '../services/lecture_group.service';
import {
  BulkCreateLectureGroupDto,
  BulkExcludeLectureGroupDto,
} from '../dto/lecture_group.dto';

@ApiTags('LectureGroup - Group')
@ApiBearerAuth('access-token')
@Controller('lecture/group')
export class LectureGroupController {
  constructor(private readonly lectureGroupService: LectureGroupService) {}

  @Post('bulk')
  @ApiOperation({
    summary: 'Bulk create: Add multiple groups to multiple lectures',
  })
  @ApiResponse({
    status: 201,
    description: 'All lecture-group relations created successfully',
  })
  async bulkCreateLectureGroups(
    @Body() dto: BulkCreateLectureGroupDto,
    @User() user: JwtPayload,
  ): Promise<void> {
    await this.lectureGroupService.bulkCreate(dto, user);
  }

  @Post('bulk/exclude')
  @ApiOperation({
    summary: 'Bulk remove: Remove multiple lectures from distributed groups',
  })
  @ApiResponse({
    status: 200,
    description: 'Lecture-group relations removed successfully',
  })
  async bulkExcludeLectureGroups(
    @Body() dto: BulkExcludeLectureGroupDto,
    @User() user: JwtPayload,
  ): Promise<{ deletedCount: number }> {
    return this.lectureGroupService.bulkExclude(dto, user);
  }
}
