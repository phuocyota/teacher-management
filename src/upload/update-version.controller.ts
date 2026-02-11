import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UploadService } from './upload.service';
import {
  UpdateVersionDto,
  UpdateVersionResponseDto,
} from './dto/upload.dto';
import { Public } from 'src/common/decorator/public.decorator';

@ApiTags('Version')
@Controller()
export class UpdateVersionController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('updateversion')
  @HttpCode(200)
  @ApiBearerAuth('access-token')
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

  @Get('updateversion')
  @Public()
  @ApiOperation({ summary: 'Lấy file version cho ichiteacher' })
  @ApiResponse({
    status: 200,
    description: 'Lấy file version thành công',
    type: UpdateVersionResponseDto,
  })
  async getVersion(): Promise<UpdateVersionResponseDto> {
    return this.uploadService.getVersionFile();
  }
}

