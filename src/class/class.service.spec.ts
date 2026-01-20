import { NotFoundException } from '@nestjs/common';
import { ClassService } from './class.service';

describe('ClassService', () => {
  let service: ClassService;
  let classRepo: any;
  let uploadService: { deleteFileByPath: jest.Mock };

  beforeEach(() => {
    classRepo = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      remove: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    uploadService = { deleteFileByPath: jest.fn() };
    service = new ClassService(classRepo, uploadService as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('create saves class', async () => {
    classRepo.create.mockReturnValue({ id: 'c1' });
    classRepo.save.mockResolvedValue({ id: 'c1' });

    const result = await service.create({ code: 'C1' } as any);

    expect(classRepo.create).toHaveBeenCalledWith({ code: 'C1' });
    expect(classRepo.save).toHaveBeenCalled();
    expect(result).toEqual({ id: 'c1' });
  });

  it('findOne throws when missing', async () => {
    classRepo.findOne.mockResolvedValue(null);

    await expect(service.findOne('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('update merges and saves', async () => {
    classRepo.findOne.mockResolvedValue({ id: 'c1', name: 'old' });
    classRepo.save.mockResolvedValue({ id: 'c1', name: 'new' });

    const result = await service.update('c1', { name: 'new' } as any);

    expect(classRepo.save).toHaveBeenCalledWith({ id: 'c1', name: 'new' });
    expect(result.name).toBe('new');
  });

  it('remove deletes image and record', async () => {
    classRepo.findOne.mockResolvedValue({
      id: 'c1',
      currentImage: 'img.png',
    });

    await service.remove('c1', { userId: 'u1' } as any);

    expect(uploadService.deleteFileByPath).toHaveBeenCalledWith('img.png');
    expect(classRepo.remove).toHaveBeenCalled();
  });

  it('getMaxCode returns 0 when no data', async () => {
    const qb = { select: jest.fn(), getRawOne: jest.fn() };
    qb.select.mockReturnValue(qb);
    qb.getRawOne.mockResolvedValue({ maxCode: null });
    classRepo.createQueryBuilder.mockReturnValue(qb);

    const result = await service.getMaxCode();

    expect(result).toBe(0);
  });

  it('getMaxCode parses numeric part', async () => {
    const qb = { select: jest.fn(), getRawOne: jest.fn() };
    qb.select.mockReturnValue(qb);
    qb.getRawOne.mockResolvedValue({ maxCode: 'BG0010' });
    classRepo.createQueryBuilder.mockReturnValue(qb);

    const result = await service.getMaxCode();

    expect(result).toBe(10);
  });
});
