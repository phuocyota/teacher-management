import { BadRequestException } from '@nestjs/common';
import { LectureUserService } from './lecture_user.service';
import * as txUtils from 'src/common/database/transaction.utils';

const makeManager = (repo: any) => ({
  getRepository: jest.fn(() => repo),
});

describe('LectureUserService', () => {
  let service: LectureUserService;
  let repo: any;

  beforeEach(() => {
    repo = {
      find: jest.fn(),
      query: jest.fn(),
      manager: {},
    };
    service = new LectureUserService(repo as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('create throws when users already exist', async () => {
    repo.find.mockResolvedValue([{ id: '1' }]);

    await expect(
      service.create({ lectureId: 'l1', userIds: ['u1'] } as any, {
        userId: 'actor',
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('create adds users in transaction', async () => {
    repo.find.mockResolvedValue([]);
    const saveFn = jest.fn();
    const manager = makeManager({ save: saveFn });

    jest
      .spyOn(txUtils, 'runInTransaction')
      .mockImplementation(async (_em: any, fn: any) => fn(manager as any));

    await service.create({ lectureId: 'l1', userIds: ['u1', 'u2'] } as any, {
      userId: 'actor',
    } as any);

    const saved = saveFn.mock.calls[0][0];
    expect(saved).toHaveLength(2);
  });

  it('update removes and adds users based on diff', async () => {
    repo.query.mockResolvedValue([{ user_ids: ['u1', 'u2'] }]);
    const repoInTx = { delete: jest.fn(), save: jest.fn() };
    const manager = makeManager(repoInTx);

    jest
      .spyOn(txUtils, 'runInTransaction')
      .mockImplementation(async (_em: any, fn: any) => fn(manager as any));

    await service.update({ lectureId: 'l1', userIds: ['u2', 'u3'] } as any, {
      userId: 'actor',
    } as any);

    expect(repoInTx.delete).toHaveBeenCalled();
    expect(repoInTx.save).toHaveBeenCalled();
  });

  it('bulkCreate saves cartesian product', async () => {
    const repoInTx = { save: jest.fn() };
    const manager = makeManager(repoInTx);

    jest
      .spyOn(txUtils, 'runInTransaction')
      .mockImplementation(async (_em: any, fn: any) => fn(manager as any));

    await service.bulkCreate(
      { lectureIds: ['l1'], userIds: ['u1', 'u2'] } as any,
      { userId: 'actor' } as any,
    );

    const saved = repoInTx.save.mock.calls[0][0];
    expect(saved).toHaveLength(2);
  });
});
