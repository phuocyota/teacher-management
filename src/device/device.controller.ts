import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { DeviceService } from './device.service';
import { CreateDeviceRequestDto, DeviceRequestDto } from './dto/device.dto';
import { DeviceRequest } from './entity/device-request.entity';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { User } from 'src/common/decorator/user.decorator';
import type { JwtPayload } from 'src/common/interface/jwt-payload.interface';

@ApiTags('Device')
@ApiBearerAuth('access-token')
@Controller('device')
export class DeviceController {
  constructor(private readonly deviceService: DeviceService) {}

  /**
   * Device gửi request đến admin để phê duyệt
   * POST /device/request
   */
  @Post('request')
  @ApiOperation({ summary: 'Tạo yêu cầu thiết bị mới' })
  @ApiResponse({
    status: 201,
    description: 'Tạo yêu cầu thiết bị thành công',
  })
  @ApiResponse({ status: 400, description: 'Dữ liệu đầu vào không hợp lệ' })
  async createDeviceRequest(
    @Body() dto: CreateDeviceRequestDto,
    @User() user: JwtPayload,
  ): Promise<DeviceRequest> {
    return this.deviceService.createDeviceRequest(dto, user);
  }

  /**
   * Admin xem danh sách request chờ phê duyệt
   * GET /device/requests/pending
   */
  @Get('requests/pending')
  @ApiOperation({ summary: 'Lấy danh sách yêu cầu thiết bị đang chờ' })
  @ApiResponse({
    status: 200,
    description: 'Lấy danh sách yêu cầu thiết bị đang chờ thành công',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy yêu cầu thiết bị đang chờ',
  })
  async getPendingRequests(): Promise<DeviceRequest[]> {
    return this.deviceService.getPendingRequests();
  }

  /**
   * Lấy chi tiết 1 device request
   * GET /device/request/:id
   */
  @Get('request/:id')
  @ApiOperation({ summary: 'Lấy chi tiết yêu cầu thiết bị' })
  @ApiResponse({
    status: 200,
    description: 'Lấy chi tiết yêu cầu thiết bị thành công',
  })
  @ApiResponse({ status: 404, description: 'Yêu cầu thiết bị không tồn tại' })
  async getDeviceRequestDetail(
    @Param('id') requestId: string,
  ): Promise<DeviceRequest> {
    return this.deviceService.getDeviceRequestDetail(requestId);
  }

  /**
   * Admin phê duyệt device request
   * PATCH /device/request/:id/approve?approvedBy=<admin-id>
   */
  @Patch('request/:id/approve')
  @ApiOperation({ summary: 'Phê duyệt yêu cầu thiết bị' })
  @ApiResponse({
    status: 200,
    description: 'Phê duyệt yêu cầu thiết bị thành công',
  })
  @ApiResponse({ status: 404, description: 'Yêu cầu thiết bị không tồn tại' })
  async approveDeviceRequest(
    @Param('id') requestId: string,
    @User() user: JwtPayload,
  ): Promise<DeviceRequestDto> {
    return this.deviceService.approveDeviceRequest(requestId, user);
  }

  /**
   * Admin từ chối device request
   * PATCH /device/request/:id/reject
   */
  @Patch('request/:id/reject')
  @ApiOperation({ summary: 'Từ chối yêu cầu thiết bị' })
  @ApiResponse({
    status: 200,
    description: 'Từ chối yêu cầu thiết bị thành công',
  })
  @ApiResponse({ status: 404, description: 'Yêu cầu thiết bị không tồn tại' })
  async rejectDeviceRequest(
    @Param('id') requestId: string,
    @Body('rejectReason') rejectReason: string,
    @User() user: JwtPayload,
  ): Promise<DeviceRequest> {
    return this.deviceService.rejectDeviceRequest(
      requestId,
      rejectReason,
      user,
    );
  }

  /**
   * Lấy danh sách approved devices của 1 user
   * GET /device/approved?userId=<user-id>
   */
  @Get('approved')
  @ApiOperation({ summary: 'Lấy danh sách thiết bị đã phê duyệt theo user ID' })
  @ApiResponse({
    status: 200,
    description: 'Lấy danh sách thiết bị đã phê duyệt thành công',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy thiết bị đã phê duyệt',
  })
  async getApprovedDevicesByUser(
    @Query('userId') userId: string,
  ): Promise<DeviceRequestDto[]> {
    return this.deviceService.getApprovedDevicesByUser(userId);
  }
}
