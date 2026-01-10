import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { LectureContextService } from 'src/lecture/services/lecture_context.service';
import { CreateLectureContextDto } from 'src/lecture/dto/lecture_context.dto';

@ApiTags('LectureContext')
@ApiBearerAuth('access-token')
@Controller('lecture/context')
export class LectureContextController {
  constructor(private readonly lectureContextService: LectureContextService) {}

  @Post('add-users')
  @ApiOperation({ summary: 'Add multiple users to a lecture' })
  @ApiResponse({ status: 200, description: 'Users added to lecture' })
  async addUsersToLecture(@Body() dto: CreateLectureContextDto): Promise<void> {
    await this.lectureContextService.create(dto);
  }
}
