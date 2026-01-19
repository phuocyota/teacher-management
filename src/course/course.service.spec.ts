import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CourseService } from './course.service';

const makeQueryBuilder = () => ({
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  getOne: jest.fn(),
  getManyAndCount: jest.fn(),
  getRawOne: jest.fn(),
});

describe('CourseService', () => {
  let service: CourseService;
  let courseRepo: any;
  let classRepo: any;
  let uploadService: { deleteFile: jest.Mock };

  beforeEach(() => {
    courseRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      remove: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    classRepo = {
      findOne: jest.fn(),
    };
    uploadService = { deleteFile: jest.fn() };
    service = new CourseService(courseRepo, classRepo, uploadService as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('create throws when classId invalid', async () => {
    classRepo.findOne.mockResolvedValue(null);

    await expect(
      service.create({ code: 'C1', classId: 'missing' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('create throws on duplicate code in class', async () => {
    classRepo.findOne.mockResolvedValue({ id: 'class1' });
    const qb = makeQueryBuilder();
    qb.getOne.mockResolvedValue({ id: 'existing' });
    courseRepo.createQueryBuilder.mockReturnValue(qb);

    await expect(
      service.create({ code: 'C1', classId: 'class1' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('create saves when no conflict', async () => {
    const qb = makeQueryBuilder();
    qb.getOne.mockResolvedValue(null);
    courseRepo.createQueryBuilder.mockReturnValue(qb);
    courseRepo.create.mockReturnValue({ id: 'c1' });
    courseRepo.save.mockResolvedValue({ id: 'c1' });

    const result = await service.create({ code: 'C1' } as any);

    expect(courseRepo.save).toHaveBeenCalled();
    expect(result).toEqual({ id: 'c1' });
  });

  it('findAll returns paged result', async () => {
    const qb = makeQueryBuilder();
    qb.getManyAndCount.mockResolvedValue([[{ id: 'c1' }], 1]);
    courseRepo.createQueryBuilder.mockReturnValue(qb);

    const result = await service.findAll(1, 10, 'q', 'class1');

    expect(result.total).toBe(1);
    expect(result.data).toHaveLength(1);
  });

  it('findOne throws when missing', async () => {
    courseRepo.findOne.mockResolvedValue(null);

    await expect(service.findOne('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('update throws on conflict', async () => {
    courseRepo.findOne.mockResolvedValue({ id: 'c1', code: 'C1' });
    const qb = makeQueryBuilder();
    qb.getOne.mockResolvedValue({ id: 'other' });
    courseRepo.createQueryBuilder.mockReturnValue(qb);

    await expect(
      service.update('c1', { code: 'C2' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('remove deletes image and record', async () => {
    courseRepo.findOne.mockResolvedValue({ id: 'c1', image: 'img.png' });

    await service.remove('c1', { userId: 'u1' } as any);

    expect(uploadService.deleteFile).toHaveBeenCalled();
    expect(courseRepo.remove).toHaveBeenCalled();
  });

  it('getMaxCode parses numeric part', async () => {
    const qb = makeQueryBuilder();
    qb.getRawOne.mockResolvedValue({ maxCode: 'KH123' });
    courseRepo.createQueryBuilder.mockReturnValue(qb);

    const result = await service.getMaxCode();

    expect(result).toBe(123);
  });
});
