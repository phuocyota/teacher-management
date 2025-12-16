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
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { User } from 'src/common/decorator/user.decorator';
import type { JwtPayload } from 'src/common/interface/jwt-payload.interface';

@Controller('device')
export class DeviceController {
  constructor(private readonly deviceService: DeviceService) {}

  /**
   * Device gửi request đến admin để phê duyệt
   * POST /device/request
   */
  @Post('request')
  @ApiOperation({ summary: 'Create a new device request' })
  @ApiResponse({
    status: 201,
    description: 'Device request created successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid input' })
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
  @ApiOperation({ summary: 'Get list of pending device requests' })
  @ApiResponse({
    status: 200,
    description: 'List of pending device requests retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'No pending device requests found' })
  async getPendingRequests(): Promise<DeviceRequest[]> {
    return this.deviceService.getPendingRequests();
  }

  /**
   * Lấy chi tiết 1 device request
   * GET /device/request/:id
   */
  @Get('request/:id')
  @ApiOperation({ summary: 'Get details of a device request' })
  @ApiResponse({
    status: 200,
    description: 'Device request details retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Device request not found' })
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
  @ApiOperation({ summary: 'Approve a device request' })
  @ApiResponse({
    status: 200,
    description: 'Device request approved successfully',
  })
  @ApiResponse({ status: 404, description: 'Device request not found' })
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
  @ApiOperation({ summary: 'Reject a device request' })
  @ApiResponse({
    status: 200,
    description: 'Device request rejected successfully',
  })
  @ApiResponse({ status: 404, description: 'Device request not found' })
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
  @ApiOperation({ summary: 'Get approved devices by user ID' })
  @ApiResponse({
    status: 200,
    description: 'List of approved devices retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'No approved devices found' })
  async getApprovedDevicesByUser(
    @Query('userId') userId: string,
  ): Promise<DeviceRequestDto[]> {
    return this.deviceService.getApprovedDevicesByUser(userId);
  }
}
