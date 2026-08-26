import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Put,
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
import { LectureUserService } from 'src/lecture/services/lecture_user.service';
import {
  CreateLectureUserDto,
  UpdateLectureUserDto,
  BulkCreateLectureUserDto,
  BulkExcludeLectureUserDto,
} from 'src/lecture/dto/lecture_user.dto';

@ApiTags('Lecture Users')
@ApiBearerAuth('access-token')
@Controller('lecture/user')
export class LectureUserController {
  constructor(private readonly lectureUserService: LectureUserService) {}

  @Post()
  @ApiOperation({ summary: 'Add multiple users to a lecture' })
  @ApiResponse({ status: 201, description: 'Users added to lecture' })
  async addUsersToLecture(
    @Body() dto: CreateLectureUserDto,
    @User() user: JwtPayload,
  ): Promise<void> {
    await this.lectureUserService.create(dto, user);
  }

  @Put()
  @ApiOperation({ summary: 'Update multiple users of a lecture' })
  @ApiResponse({ status: 200, description: 'Users updated for lecture' })
  async updateUsersToLecture(
    @Body() dto: UpdateLectureUserDto,
    @User() user: JwtPayload,
  ): Promise<void> {
    await this.lectureUserService.update(dto, user);
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
    @Body() dto: BulkCreateLectureUserDto,
    @User() user: JwtPayload,
  ): Promise<void> {
    await this.lectureUserService.bulkCreate(dto, user);
  }

  @Post('bulk/exclude')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: 'Gỡ nhiều bài giảng khỏi nhiều người dùng' })
  @ApiResponse({
    status: 200,
    description: 'Gỡ phân công bài giảng thành công',
  })
  @ApiResponse({ status: 400, description: 'Danh sách đầu vào không hợp lệ' })
  async bulkExcludeLectureUsers(
    @Body() dto: BulkExcludeLectureUserDto,
  ): Promise<{
    success: true;
    message: string;
    data: { deletedCount: number };
  }> {
    const data = await this.lectureUserService.bulkExclude(dto);

    return {
      success: true,
      message: 'Gỡ phân công bài giảng thành công',
      data,
    };
  }
}
