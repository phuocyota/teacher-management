import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { LectureService } from './lecture.service';
import { UserType } from 'src/common/enum/user-type.enum';
import { Source } from '../enum/lecture-resource.enum';
import * as txUtils from 'src/common/database/transaction.utils';

const makeQueryBuilder = () => ({
  leftJoin: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  distinct: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  getRawMany: jest.fn(),
  getCount: jest.fn(),
});

describe('LectureService', () => {
  let service: LectureService;
  let lectureRepo: any;
  let entityManager: any;
  let groupService: any;
  let uploadService: any;

  beforeEach(() => {
    lectureRepo = {
      createQueryBuilder: jest.fn(),
      findOne: jest.fn(),
    };
    entityManager = {};
    groupService = { checkById: jest.fn() };
    uploadService = { deleteFileByPath: jest.fn() };

    service = new LectureService(
      lectureRepo,
      entityManager as any,
      groupService,
      uploadService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('create saves lecture, resources, and group context', async () => {
    const manager = {
      create: jest.fn((_entity: any, data: any) => ({ ...data })),
      save: jest.fn(async (entity: any) => ({ ...entity, id: 'l1' })),
    };

    jest
      .spyOn(txUtils, 'runInTransaction')
      .mockImplementation(async (_em: any, fn: any) => fn(manager as any));

    const result = await service.create(
      {
        code: 'L1',
        title: 'Lecture',
        resources: [
          { type: 'PDF', source: 'OFFLINE', url: 'f1' },
          { type: 'VIDEO', source: 'OFFLINE', url: 'f2' },
        ],
        groupId: 'g1',
        courseId: 'c1',
      } as any,
      { userId: 'u1' } as any,
    );

    expect(groupService.checkById).toHaveBeenCalledWith('g1');
    expect(manager.save).toHaveBeenCalled();
    expect(result.id).toBe('l1');
  });

  it('findAll applies access filter for non-admin', async () => {
    const qb = makeQueryBuilder();
    qb.getRawMany.mockResolvedValue([{ id: 'l1' }]);
    qb.getCount.mockResolvedValue(1);
    lectureRepo.createQueryBuilder.mockReturnValue(qb);

    const result = await service.findAll(
      { page: 1, size: 10 } as any,
      { userId: 'u1', userType: UserType.TEACHER } as any,
    );

    expect(qb.andWhere).toHaveBeenCalled();
    expect(result.total).toBe(1);
  });

  it('findOne throws when not found', async () => {
    lectureRepo.findOne.mockResolvedValue(null);

    await expect(
      service.findOne('missing', { userId: 'u1', userType: UserType.ADMIN } as any),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('findOne hides lecture when user has no access', async () => {
    lectureRepo.findOne.mockResolvedValue({ id: 'l1', resources: [] });
    const qb = { where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(), getCount: jest.fn() };
    qb.getCount.mockResolvedValue(0);
    lectureRepo.createQueryBuilder.mockReturnValue(qb);

    await expect(
      service.findOne('l1', { userId: 'u1', userType: UserType.TEACHER } as any),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('update throws on duplicate code', async () => {
    const manager = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce({ id: 'l1', code: 'L1', createdBy: 'u1' })
        .mockResolvedValueOnce({ id: 'other', code: 'L2' }),
      save: jest.fn(),
    };

    jest
      .spyOn(txUtils, 'runInTransaction')
      .mockImplementation(async (_em: any, fn: any) => fn(manager as any));

    await expect(
      service.update(
        'l1',
        { code: 'L2' } as any,
        { userId: 'u1', userType: UserType.ADMIN } as any,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('remove deletes offline resources and avatar', async () => {
    const manager = {
      findOne: jest.fn().mockResolvedValue({
        id: 'l1',
        createdBy: 'u1',
        resources: [
          { source: Source.OFFLINE, url: 'r1' },
          { source: Source.ONLINE, url: 'r2' },
        ],
        avatar: 'a1',
      }),
      delete: jest.fn(),
    };

    jest
      .spyOn(txUtils, 'runInTransaction')
      .mockImplementation(async (_em: any, fn: any) => fn(manager as any));

    await service.remove('l1', { userId: 'u1', userType: UserType.ADMIN } as any);

    expect(uploadService.deleteFileByPath).toHaveBeenCalledWith('r1');
    expect(uploadService.deleteFileByPath).toHaveBeenCalledWith('a1');
    expect(manager.delete).toHaveBeenCalled();
  });

  it('getMaxCode parses numeric part', async () => {
    const qb = { select: jest.fn().mockReturnThis(), getRawOne: jest.fn() };
    qb.getRawOne.mockResolvedValue({ maxCode: 'BG010' });
    lectureRepo.createQueryBuilder.mockReturnValue(qb);

    const result = await service.getMaxCode();

    expect(result).toBe(10);
  });
});
