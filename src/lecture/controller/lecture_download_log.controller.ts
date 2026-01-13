import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { User } from 'src/common/decorator/user.decorator';
import type { JwtPayload } from 'src/common/interface/jwt-payload.interface';
import { LectureDownloadLogService } from '../services/lecture_download_log.service';
import {
  CreateDownloadLogDto,
  GetDownloadLogQueryDto,
} from '../dto/download-log.dto';

@ApiTags('Lecture Download Log')
@ApiBearerAuth('access-token')
@Controller('lecture/download-log')
export class LectureDownloadLogController {
  constructor(private readonly downloadLogService: LectureDownloadLogService) {}

  @Post()
  @ApiOperation({ summary: 'Log user download activity' })
  @ApiResponse({ status: 201, description: 'Download log created' })
  async logDownload(
    @Body() dto: CreateDownloadLogDto,
    @User() user: JwtPayload,
  ): Promise<void> {
    await this.downloadLogService.create(dto, user.userId);
  }

  @Get()
  @ApiOperation({ summary: 'Get download logs with pagination and filters' })
  @ApiResponse({ status: 200, description: 'List of download logs' })
  async getDownloadLogs(
    @Query() query: GetDownloadLogQueryDto,
    @User() user: JwtPayload,
  ) {
    return this.downloadLogService.findAll(query, user.userId);
  }
}
