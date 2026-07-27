import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from 'src/common/decorator/public.decorator';
import { AttemptService } from './attempt.service';
import {
  EndAttemptDto,
  EndAttemptResponseDto,
  StartAttemptResponseDto,
  StartPublicAttemptDto,
} from './dto/attempt-session.dto';

@Public()
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
@ApiTags('Public Attempt')
@Controller('public-attempt')
export class PublicAttemptController {
  constructor(private readonly attemptService: AttemptService) {}

  @Post('start')
  @ApiOperation({
    summary: 'Bắt đầu làm đề thi thử không cần đăng nhập',
  })
  @ApiCreatedResponse({ type: StartAttemptResponseDto })
  start(@Body() dto: StartPublicAttemptDto) {
    return this.attemptService.startPublic(dto);
  }

  @Post(':id/end')
  @ApiOperation({
    summary: 'Nộp và chấm bài thi thử không cần đăng nhập',
  })
  @ApiOkResponse({ type: EndAttemptResponseDto })
  end(@Param('id', ParseUUIDPipe) id: string, @Body() dto: EndAttemptDto) {
    return this.attemptService.endPublic(id, dto);
  }
}
