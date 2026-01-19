import { ForbiddenException } from '@nestjs/common';
import { GroupService } from './group.service';
import { UserType } from 'src/common/enum/user-type.enum';

const mockGroup = {
  id: 'g1',
  name: 'Group',
  createdBy: 'u1',
};

describe('GroupService', () => {
  let service: GroupService;
  let groupRepoService: any;
  let entityManager: { remove: jest.Mock };

  beforeEach(() => {
    groupRepoService = {
      findOneById: jest.fn(),
      save: jest.fn(),
      findAllGroups: jest.fn(),
      findAllWithMemberCount: jest.fn(),
      searchByName: jest.fn(),
      getMaxCode: jest.fn(),
    };
    entityManager = { remove: jest.fn() };
    service = new GroupService(groupRepoService, entityManager as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('checkById returns mapped dto', async () => {
    groupRepoService.findOneById.mockResolvedValue(mockGroup);

    const result = await service.checkById('g1');

    expect(result.id).toBe('g1');
  });

  it('create saves group', async () => {
    groupRepoService.save.mockResolvedValue(mockGroup);

    const result = await service.create({ name: 'Group' } as any, {
      userId: 'u1',
    } as any);

    expect(groupRepoService.save).toHaveBeenCalled();
    expect(result.id).toBe('g1');
  });

  it('update forbids non-admin non-owner', async () => {
    groupRepoService.findOneById.mockResolvedValue({
      ...mockGroup,
      createdBy: 'owner',
    });

    await expect(
      service.update('g1', { name: 'New' } as any, {
        userId: 'u2',
        userType: UserType.TEACHER,
      } as any),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('remove forbids non-admin', async () => {
    groupRepoService.findOneById.mockResolvedValue(mockGroup);

    await expect(
      service.remove('g1', { userId: 'u1', userType: UserType.TEACHER } as any),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('findAll returns list', async () => {
    groupRepoService.findAllGroups.mockResolvedValue([mockGroup]);

    const result = await service.findAll();

    expect(result).toHaveLength(1);
  });
});
