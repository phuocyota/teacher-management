import { NotFoundException } from '@nestjs/common';
import { UserRepositoryService } from './user-repository.service';

describe('UserRepositoryService', () => {
  let service: UserRepositoryService;
  let repo: { findOne: jest.Mock; find: jest.Mock };

  beforeEach(() => {
    repo = {
      findOne: jest.fn(),
      find: jest.fn(),
    };
    service = new UserRepositoryService(repo as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('findOneById returns entity', async () => {
    repo.findOne.mockResolvedValue({ id: 'u1' });

    const result = await service.findOneById('u1');

    expect(result).toEqual({ id: 'u1' });
  });

  it('validateUser throws when not found', async () => {
    repo.findOne.mockResolvedValue(null);

    await expect(service.validateUser('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('findByIds returns users', async () => {
    repo.find.mockResolvedValue([{ id: 'u1' }, { id: 'u2' }]);

    const result = await service.findByIds(['u1', 'u2']);

    expect(result).toHaveLength(2);
  });
});
