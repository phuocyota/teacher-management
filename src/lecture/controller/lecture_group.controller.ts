import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
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
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({
    summary: 'Bulk remove: Remove multiple lectures from distributed groups',
  })
  @ApiResponse({
    status: 200,
    description: 'Gỡ phân công bài giảng thành công',
  })
  @ApiResponse({ status: 400, description: 'Danh sách đầu vào không hợp lệ' })
  async bulkExcludeLectureGroups(
    @Body() dto: BulkExcludeLectureGroupDto,
  ): Promise<{
    success: true;
    message: string;
    data: { deletedCount: number };
  }> {
    const data = await this.lectureGroupService.bulkExclude(dto);

    return {
      success: true,
      message: 'Gỡ phân công bài giảng thành công',
      data,
    };
  }
}
