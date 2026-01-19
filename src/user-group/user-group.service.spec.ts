import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserGroupService } from './user-group.service';
import { GroupMemberRole } from './enum/group-member-role.enum';
import * as txUtils from 'src/common/database/transaction.utils';
import { UserType } from 'src/common/enum/user-type.enum';

const makeManager = (repo: any) => ({
  create: jest.fn((_entity: any, data: any) => data),
  save: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
  delete: jest.fn(),
  getRepository: jest.fn(() => repo),
});

describe('UserGroupService', () => {
  let service: UserGroupService;
  let userGroupRepo: any;
  let userRepoService: any;
  let groupRepoService: any;
  let entityManager: any;

  beforeEach(() => {
    userGroupRepo = {
      query: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
    };
    userRepoService = { validateUser: jest.fn() };
    groupRepoService = { findOneById: jest.fn(), findById: jest.fn(), validateGroupsExist: jest.fn() };
    entityManager = {
      connection: { transaction: jest.fn() },
      find: jest.fn(),
      findOne: jest.fn(),
    };

    service = new UserGroupService(
      userGroupRepo,
      userRepoService,
      groupRepoService,
      entityManager as any,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('getUserGroupsDetail validates user and returns data', async () => {
    userRepoService.validateUser.mockResolvedValue(undefined);
    userGroupRepo.query.mockResolvedValue([{ id: 'g1' }]);

    const result = await service.getUserGroupsDetail('u1');

    expect(userRepoService.validateUser).toHaveBeenCalledWith('u1');
    expect(result).toHaveLength(1);
  });

  it('checkMembership returns false when missing', async () => {
    userGroupRepo.findOne.mockResolvedValue(null);

    const result = await service.checkMembership('u1', 'g1');

    expect(result).toEqual({ isMember: false, role: undefined });
  });

  it('addUsersToGroup creates records', async () => {
    const repoInTx = { create: jest.fn((d: any) => d), save: jest.fn() };
    const manager = makeManager(repoInTx);
    groupRepoService.findById.mockResolvedValue({ id: 'g1' });

    jest
      .spyOn(txUtils, 'runInTransaction')
      .mockImplementation(async (_em: any, fn: any) => fn(manager as any));

    await service.addUsersToGroup(
      'g1',
      { users: ['u1', 'u2'] } as any,
      { userId: 'admin' } as any,
    );

    expect(manager.save).toHaveBeenCalled();
  });

  it('updateUserGroups removes and adds differences', async () => {
    groupRepoService.validateGroupsExist.mockResolvedValue(undefined);
    const repoInTx = {
      find: jest.fn().mockResolvedValue([{ groupId: 'g1' }]),
      delete: jest.fn(),
      save: jest.fn(),
      create: jest.fn((d: any) => d),
    };
    const manager = { getRepository: jest.fn(() => repoInTx) };

    await service.updateUserGroups(['g2'], 'u1', 'admin', manager as any);

    expect(repoInTx.delete).toHaveBeenCalled();
    expect(repoInTx.save).toHaveBeenCalled();
  });

  it('removeUsersFromGroup forbids when not admin or owner', async () => {
    const manager = makeManager({});
    manager.findOne.mockResolvedValue({ id: 'g1', createdBy: 'owner', members: [] });

    entityManager.connection.transaction.mockImplementation(
      async (fn: any) => fn(manager),
    );

    await expect(
      service.removeUsersFromGroup('g1', ['u1'], {
        userId: 'other',
        userType: UserType.TEACHER,
      } as any),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('updateMemberRole forbids non-leader', async () => {
    const manager = makeManager({});
    manager.findOne.mockResolvedValue(null);

    jest
      .spyOn(txUtils, 'runInTransaction')
      .mockImplementation(async (_em: any, fn: any) => fn(manager as any));

    await expect(
      service.updateMemberRole('g1', 'u2', GroupMemberRole.MEMBER, {
        userId: 'u1',
        userType: UserType.TEACHER,
      } as any),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('getMyGroups throws when user missing and no groups', async () => {
    entityManager.find.mockResolvedValue([]);
    entityManager.findOne.mockResolvedValue(null);

    await expect(
      service.getMyGroups({ userId: 'u1' } as any),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
