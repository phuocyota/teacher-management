import { NotFoundException } from '@nestjs/common';
import { GroupRepositoryService } from './group-repository.service';

const makeQueryBuilder = () => ({
  select: jest.fn().mockReturnThis(),
  getRawOne: jest.fn(),
});

describe('GroupRepositoryService', () => {
  let service: GroupRepositoryService;
  let repo: any;

  beforeEach(() => {
    repo = {
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      query: jest.fn(),
      createQueryBuilder: jest.fn(),
      countBy: jest.fn(),
    };
    service = new GroupRepositoryService(repo as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('findOneById throws when missing', async () => {
    repo.findOne.mockResolvedValue(null);

    await expect(service.findOneById('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('findAllGroups includes relations', async () => {
    repo.find.mockResolvedValue([{ id: 'g1' }]);

    await service.findAllGroups(true);

    expect(repo.find).toHaveBeenCalledWith({
      relations: ['members', 'members.user'],
      order: { createdAt: 'DESC' },
    });
  });

  it('findAllWithMemberCount maps results', async () => {
    repo.query.mockResolvedValue([{ id: 'g1', count: '1' }]);

    const result = await service.findAllWithMemberCount();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('g1');
  });

  it('validateGroupsExist throws when count mismatch', async () => {
    repo.countBy.mockResolvedValue(1);

    await expect(service.validateGroupsExist(['a', 'b'])).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('getMaxCode returns value', async () => {
    const qb = makeQueryBuilder();
    qb.getRawOne.mockResolvedValue({ maxCode: 3 });
    repo.createQueryBuilder.mockReturnValue(qb);

    const result = await service.getMaxCode();

    expect(result).toBe(3);
  });
});
