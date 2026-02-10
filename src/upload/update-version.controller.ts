import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UploadService } from './upload.service';
import {
  UpdateVersionDto,
  UpdateVersionResponseDto,
} from './dto/upload.dto';

@ApiTags('Version')
@ApiBearerAuth('access-token')
@Controller()
export class UpdateVersionController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('updateversion')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cập nhật file version cho ichiteacher' })
  @ApiResponse({
    status: 200,
    description: 'Cập nhật file version thành công',
    type: UpdateVersionResponseDto,
  })
  async updateVersion(
    @Body() dto: UpdateVersionDto,
  ): Promise<UpdateVersionResponseDto> {
    return this.uploadService.updateVersionFile(dto);
  }
}
