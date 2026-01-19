import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { UserService } from './user.service';
import * as txUtils from 'src/common/database/transaction.utils';

const makeQueryRunner = (userRepo: any) => ({
  connect: jest.fn(),
  startTransaction: jest.fn(),
  commitTransaction: jest.fn(),
  rollbackTransaction: jest.fn(),
  release: jest.fn(),
  manager: {
    getRepository: jest.fn(() => userRepo),
  },
});

describe('UserService', () => {
  let service: UserService;
  let repo: any;
  let userGroupService: any;
  let entityManager: any;

  beforeEach(() => {
    repo = {
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
      update: jest.fn(),
    };
    userGroupService = {
      addUserToGroups: jest.fn(),
      updateUserGroups: jest.fn(),
    };
    entityManager = {
      connection: {
        createQueryRunner: jest.fn(),
      },
    };

    service = new UserService(repo, userGroupService, entityManager as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('findByUsernameOrEmail returns user', async () => {
    repo.findOne.mockResolvedValue({ id: 'u1' });

    const result = await service.findByUsernameOrEmail('u1');

    expect(result).toEqual({ id: 'u1' });
  });

  it('createUser throws on existing username', async () => {
    repo.findOne.mockResolvedValue({ userName: 'u1' });
    const manager = { getRepository: jest.fn(() => ({ save: jest.fn(), create: jest.fn() })) };

    jest
      .spyOn(txUtils, 'runInTransaction')
      .mockImplementation(async (_em: any, fn: any) => fn(manager as any));

    await expect(
      service.createUser({ userName: 'u1', email: 'e', password: 'p' } as any),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('createUser hashes password and saves', async () => {
    repo.findOne.mockResolvedValue(null);
    const userRepo = {
      save: jest.fn(async (u: any) => ({ ...u, id: 'u1' })),
      create: jest.fn((u: any) => u),
    };
    const manager = { getRepository: jest.fn(() => userRepo) };

    jest
      .spyOn(txUtils, 'runInTransaction')
      .mockImplementation(async (_em: any, fn: any) => fn(manager as any));
    jest.spyOn(bcrypt, 'hash').mockResolvedValue('hash' as any);

    const result = await service.createUser(
      { userName: 'u1', email: 'e', password: 'p', groupIds: ['g1'] } as any,
      { userId: 'admin' } as any,
    );

    expect(result.id).toBe('u1');
    expect(userGroupService.addUserToGroups).toHaveBeenCalled();
  });

  it('updateUser throws when missing', async () => {
    const userRepo = { findOne: jest.fn().mockResolvedValue(null) };
    const manager = { getRepository: jest.fn(() => userRepo) };

    jest
      .spyOn(txUtils, 'runInTransaction')
      .mockImplementation(async (_em: any, fn: any) => fn(manager as any));

    await expect(
      service.updateUser('missing', { email: 'e' } as any),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('changePassword throws when current password mismatch', async () => {
    const userRepo = { findOne: jest.fn(), save: jest.fn() };
    const queryRunner = makeQueryRunner(userRepo);
    entityManager.connection.createQueryRunner.mockReturnValue(queryRunner);

    userRepo.findOne.mockResolvedValue({ id: 'u1', hashPassword: 'hash' });
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as any);

    await expect(
      service.changePassword('u1', { currentPassword: 'a', newPassword: 'b' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
  });

  it('toggleDisabled flips flag', async () => {
    const userRepo = { findOne: jest.fn(), save: jest.fn() };
    const queryRunner = makeQueryRunner(userRepo);
    entityManager.connection.createQueryRunner.mockReturnValue(queryRunner);

    userRepo.findOne.mockResolvedValue({ id: 'u1', isDisabled: false });
    userRepo.save.mockResolvedValue({ id: 'u1', isDisabled: true });

    const result = await service.toggleDisabled('u1', { userId: 'admin' } as any);

    expect(result.isDisabled).toBe(true);
    expect(queryRunner.commitTransaction).toHaveBeenCalled();
  });
});
