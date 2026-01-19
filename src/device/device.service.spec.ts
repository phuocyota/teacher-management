import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DeviceService } from './device.service';
import { DeviceRequestStatus } from './enum/device-request.enum';

const makeManager = () => ({
  findOne: jest.fn(),
  save: jest.fn(),
});

describe('DeviceService', () => {
  let service: DeviceService;
  let deviceRequestRepo: any;
  let approvedDeviceRepo: any;

  beforeEach(() => {
    deviceRequestRepo = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      manager: { connection: { transaction: jest.fn() } },
    };
    approvedDeviceRepo = {
      create: jest.fn(),
      find: jest.fn(),
    };

    service = new DeviceService(deviceRequestRepo, approvedDeviceRepo);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('createDeviceRequest saves pending request', async () => {
    deviceRequestRepo.create.mockReturnValue({ id: 'r1' });
    deviceRequestRepo.save.mockResolvedValue({ id: 'r1' });

    const result = await service.createDeviceRequest(
      { deviceId: 'd1', productKey: 'p1' } as any,
      { userId: 'u1' } as any,
    );

    expect(deviceRequestRepo.create).toHaveBeenCalled();
    expect(deviceRequestRepo.save).toHaveBeenCalled();
    expect(result).toEqual({ id: 'r1' });
  });

  it('getPendingRequests queries by status', async () => {
    deviceRequestRepo.find.mockResolvedValue([{ id: 'r1' }]);

    const result = await service.getPendingRequests();

    expect(deviceRequestRepo.find).toHaveBeenCalledWith({
      where: { status: DeviceRequestStatus.PENDING },
      order: { createdAt: 'ASC' },
    });
    expect(result).toHaveLength(1);
  });

  it('approveDeviceRequest throws when not found', async () => {
    const manager = makeManager();
    manager.findOne.mockResolvedValue(null);

    deviceRequestRepo.manager.connection.transaction.mockImplementation(
      async (fn: any) => fn(manager),
    );

    await expect(
      service.approveDeviceRequest('missing', { userId: 'u1' } as any),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('approveDeviceRequest throws when already processed', async () => {
    const manager = makeManager();
    manager.findOne.mockResolvedValue({
      id: 'r1',
      status: DeviceRequestStatus.APPROVED,
    });

    deviceRequestRepo.manager.connection.transaction.mockImplementation(
      async (fn: any) => fn(manager),
    );

    await expect(
      service.approveDeviceRequest('r1', { userId: 'u1' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('approveDeviceRequest approves and creates record', async () => {
    const manager = makeManager();
    manager.findOne.mockResolvedValue({
      id: 'r1',
      status: DeviceRequestStatus.PENDING,
      createdBy: 'u1',
      deviceId: 'd1',
      productKey: 'p1',
    });
    manager.save.mockImplementation(async (value: any) => value);

    approvedDeviceRepo.create.mockReturnValue({ id: 'a1' });

    deviceRequestRepo.manager.connection.transaction.mockImplementation(
      async (fn: any) => fn(manager),
    );

    const result = await service.approveDeviceRequest('r1', {
      userId: 'admin',
    } as any);

    expect(approvedDeviceRepo.create).toHaveBeenCalled();
    expect(result).toEqual({ id: 'a1' });
  });

  it('rejectDeviceRequest throws when missing', async () => {
    deviceRequestRepo.findOne.mockResolvedValue(null);

    await expect(
      service.rejectDeviceRequest('missing', 'reason', { userId: 'u1' } as any),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejectDeviceRequest updates status', async () => {
    deviceRequestRepo.findOne.mockResolvedValue({
      id: 'r1',
      status: DeviceRequestStatus.PENDING,
    });
    deviceRequestRepo.save.mockResolvedValue({ id: 'r1' });

    const result = await service.rejectDeviceRequest('r1', 'reason', {
      userId: 'u1',
    } as any);

    expect(result).toEqual({ id: 'r1' });
    expect(deviceRequestRepo.save).toHaveBeenCalled();
  });

  it('getDeviceRequestDetail throws when missing', async () => {
    deviceRequestRepo.findOne.mockResolvedValue(null);

    await expect(service.getDeviceRequestDetail('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('getApprovedDevicesByUser returns records', async () => {
    approvedDeviceRepo.find.mockResolvedValue([{ id: 'a1' }]);

    const result = await service.getApprovedDevicesByUser('u1');

    expect(result).toHaveLength(1);
  });
});
