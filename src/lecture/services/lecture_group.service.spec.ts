import { LectureGroupService } from './lecture_group.service';
import * as txUtils from 'src/common/database/transaction.utils';

const makeManager = (saveFn: jest.Mock) => ({
  getRepository: jest.fn(() => ({ save: saveFn })),
});

describe('LectureGroupService', () => {
  let service: LectureGroupService;
  let repo: any;

  beforeEach(() => {
    repo = { manager: {} };
    service = new LectureGroupService(repo as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('bulkCreate saves cartesian product', async () => {
    const saveFn = jest.fn();
    const manager = makeManager(saveFn);

    jest
      .spyOn(txUtils, 'runInTransaction')
      .mockImplementation(async (_em: any, fn: any) => fn(manager as any));

    await service.bulkCreate(
      { lectureIds: ['l1', 'l2'], groupIds: ['g1', 'g2'] } as any,
      { userId: 'u1' } as any,
    );

    expect(saveFn).toHaveBeenCalledTimes(1);
    const savedEntities = saveFn.mock.calls[0][0];
    expect(savedEntities).toHaveLength(4);
  });
});
