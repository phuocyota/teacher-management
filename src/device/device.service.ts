import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeviceRequest } from './entity/device-request.entity';
import { ApprovedDeviceEntity } from './entity/approved-device.entity';
import { CreateDeviceRequestDto, DeviceRequestDto } from './dto/device.dto';
import { DeviceRequestStatus } from './enum/device-request.enum';
import { JwtPayload } from 'src/common/interface/jwt-payload.interface';
import {
  ERROR_MESSAGES,
  ENTITY_NAMES,
} from 'src/common/constant/error-messages.constant';

@Injectable()
export class DeviceService {
  constructor(
    @InjectRepository(DeviceRequest)
    private readonly deviceRequestRepo: Repository<DeviceRequest>,
    @InjectRepository(ApprovedDeviceEntity)
    private readonly approvedDeviceRepo: Repository<ApprovedDeviceEntity>,
  ) {}

  /**
   * Device gửi request đến admin
   */
  async createDeviceRequest(
    dto: CreateDeviceRequestDto,
    user: JwtPayload,
  ): Promise<DeviceRequest> {
    const deviceRequest = this.deviceRequestRepo.create({
      createdBy: user.userId,
      deviceId: dto.deviceId,
      productKey: dto.productKey,
      metadata: dto.metadata ? dto.metadata : {},
      status: DeviceRequestStatus.PENDING,
    });

    const saved = await this.deviceRequestRepo.save(deviceRequest);

    return saved;
  }

  /**
   * Admin xem danh sách request chờ phê duyệt
   */
  async getPendingRequests(): Promise<DeviceRequest[]> {
    return this.deviceRequestRepo.find({
      where: { status: DeviceRequestStatus.PENDING },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Admin phê duyệt device request
   * Sử dụng transaction để đảm bảo tính nhất quán
   */
  async approveDeviceRequest(
    id: string,
    user: JwtPayload,
  ): Promise<DeviceRequestDto> {
    // Sử dụng transaction
    return this.deviceRequestRepo.manager.connection.transaction(
      async (manager) => {
        const deviceRequest = await manager.findOne(DeviceRequest, {
          where: { id },
        });

        if (!deviceRequest) {
          throw new NotFoundException(
            ERROR_MESSAGES.NOT_FOUND_WITH_ID(ENTITY_NAMES.DEVICE_REQUEST, id),
          );
        }

        if (deviceRequest.status !== DeviceRequestStatus.PENDING) {
          throw new BadRequestException(
            ERROR_MESSAGES.DEVICE_REQUEST_ALREADY_PROCESSED(
              deviceRequest.status,
            ),
          );
        }

        // Cập nhật status của request
        deviceRequest.status = DeviceRequestStatus.APPROVED;
        deviceRequest.updatedBy = user.userId;
        await manager.save(deviceRequest);

        // Tạo approved device record
        const approvedDevice = this.approvedDeviceRepo.create({
          userId: deviceRequest.createdBy,
          deviceId: deviceRequest.deviceId,
          productKey: deviceRequest.productKey,
          approvedBy: user.userId,
        });

        const savedApproved = await manager.save(approvedDevice);
        return savedApproved;
      },
    );
  }

  /**
   * Admin từ chối device request
   */
  async rejectDeviceRequest(
    requestId: string,
    rejectReason: string,
    user: JwtPayload,
  ): Promise<DeviceRequest> {
    const deviceRequest = await this.deviceRequestRepo.findOne({
      where: { id: requestId },
    });

    if (!deviceRequest) {
      throw new NotFoundException(
        ERROR_MESSAGES.NOT_FOUND_WITH_ID(
          ENTITY_NAMES.DEVICE_REQUEST,
          requestId,
        ),
      );
    }

    if (deviceRequest.status !== DeviceRequestStatus.PENDING) {
      throw new BadRequestException(
        ERROR_MESSAGES.DEVICE_REQUEST_ALREADY_PROCESSED(deviceRequest.status),
      );
    }

    deviceRequest.status = DeviceRequestStatus.REJECT;
    deviceRequest.rejectReason = rejectReason;
    deviceRequest.updatedBy = user.userId;

    const saved = await this.deviceRequestRepo.save(deviceRequest);

    return saved;
  }

  /**
   * Lấy thông tin chi tiết device request
   */
  async getDeviceRequestDetail(requestId: string): Promise<DeviceRequest> {
    const deviceRequest = await this.deviceRequestRepo.findOne({
      where: { id: requestId },
    });

    if (!deviceRequest) {
      throw new NotFoundException(
        ERROR_MESSAGES.NOT_FOUND_WITH_ID(
          ENTITY_NAMES.DEVICE_REQUEST,
          requestId,
        ),
      );
    }

    return deviceRequest;
  }

  /**
   * Lấy danh sách approved devices của 1 user
   */
  async getApprovedDevicesByUser(userId: string): Promise<DeviceRequestDto[]> {
    return this.approvedDeviceRepo.find({
      where: { userId },
      order: { approvedAt: 'DESC' },
    });
  }
}
