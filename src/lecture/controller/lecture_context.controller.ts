import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { User } from 'src/common/decorator/user.decorator';
import type { JwtPayload } from 'src/common/interface/jwt-payload.interface';
import { LectureContextService } from '../services/lecture_context.service';
import { BulkCreateLectureContextDto } from '../dto/lecture_context.dto';

@ApiTags('LectureContext - Group')
@ApiBearerAuth('access-token')
@Controller('lecture/group')
export class LectureContextController {
  constructor(private readonly lectureContextService: LectureContextService) {}

  @Post('bulk')
  @ApiOperation({
    summary: 'Bulk create: Add multiple groups to multiple lectures',
  })
  @ApiResponse({
    status: 201,
    description: 'All lecture-group relations created successfully',
  })
  async bulkCreateLectureGroups(
    @Body() dto: BulkCreateLectureContextDto,
    @User() user: JwtPayload,
  ): Promise<void> {
    await this.lectureContextService.bulkCreate(dto, user);
  }
}
