import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { LectureDownloadLogService } from './lecture_download_log.service';
import { UserType } from 'src/common/enum/user-type.enum';

const makeQueryBuilder = () => ({
  leftJoinAndSelect: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  getManyAndCount: jest.fn(),
});

describe('LectureDownloadLogService', () => {
  let service: LectureDownloadLogService;
  let repo: any;

  beforeEach(() => {
    repo = {
      save: jest.fn(),
      createQueryBuilder: jest.fn(),
      findOne: jest.fn(),
      delete: jest.fn(),
    };
    service = new LectureDownloadLogService(repo as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('create saves log', async () => {
    repo.save.mockResolvedValue({ id: 'l1' });

    await service.create({ lectureId: 'lec', path: 'p', type: 'pdf' } as any, 'u1');

    expect(repo.save).toHaveBeenCalled();
  });

  it('findAll returns paged data', async () => {
    const qb = makeQueryBuilder();
    qb.getManyAndCount.mockResolvedValue([[{ id: 'l1' }], 1]);
    repo.createQueryBuilder.mockReturnValue(qb);

    const result = await service.findAll({ page: 1, size: 10 } as any, 'u1');

    expect(result.total).toBe(1);
    expect(result.data).toHaveLength(1);
  });

  it('delete throws when log missing', async () => {
    repo.findOne.mockResolvedValue(null);

    await expect(
      service.delete('missing', 'u1', UserType.ADMIN),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('delete forbids non-owner non-admin', async () => {
    repo.findOne.mockResolvedValue({ id: 'l1', createdBy: 'owner' });

    await expect(
      service.delete('l1', 'other', UserType.TEACHER),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('delete removes log for owner', async () => {
    repo.findOne.mockResolvedValue({ id: 'l1', createdBy: 'u1' });

    await service.delete('l1', 'u1', UserType.TEACHER);

    expect(repo.delete).toHaveBeenCalledWith('l1');
  });
});
