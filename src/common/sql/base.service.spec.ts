import { NotFoundException } from '@nestjs/common';
import { BaseService } from './base.service';
import { BaseEntity } from './base.entity';
import type { JwtPayload } from '../interface/jwt-payload.interface';

class TestEntity extends BaseEntity {
  name?: string;
}

class TestService extends BaseService<TestEntity> {
  protected getEntityName(): string {
    return 'TestEntity';
  }
}

describe('BaseService', () => {
  let repo: any;
  let service: TestService;

  beforeEach(() => {
    repo = {
      find: jest.fn(),
      findOne: jest.fn(),
      findBy: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
      manager: {
        connection: {
          createQueryRunner: jest.fn(),
        },
      },
    };

    service = new TestService(repo);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('runInTransaction commits on success', async () => {
    const queryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {},
    };

    repo.manager.connection.createQueryRunner.mockReturnValue(queryRunner);

    const result = await service.runInTransaction(async () => 'ok');

    expect(result).toBe('ok');
    expect(queryRunner.connect).toHaveBeenCalledTimes(1);
    expect(queryRunner.startTransaction).toHaveBeenCalledTimes(1);
    expect(queryRunner.commitTransaction).toHaveBeenCalledTimes(1);
    expect(queryRunner.rollbackTransaction).not.toHaveBeenCalled();
    expect(queryRunner.release).toHaveBeenCalledTimes(1);
  });

  it('runInTransaction rolls back on error', async () => {
    const queryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {},
    };

    repo.manager.connection.createQueryRunner.mockReturnValue(queryRunner);

    await expect(
      service.runInTransaction(async () => {
        throw new Error('fail');
      }),
    ).rejects.toThrow('fail');

    expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
    expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(queryRunner.release).toHaveBeenCalledTimes(1);
  });

  it('findOne throws when not found', async () => {
    repo.findOne.mockResolvedValue(null);

    await expect(service.findOne('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('findByIds throws when empty', async () => {
    repo.findBy.mockResolvedValue([]);

    await expect(service.findByIds(['a'])).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('create sets createdBy and saves', async () => {
    const dto = { name: 'test' };
    const user = { userId: 'u1' } as JwtPayload;
    const entity = { id: '1', name: 'test' } as TestEntity;

    repo.create.mockReturnValue(entity);
    repo.save.mockResolvedValue(entity);

    const result = await service.create(dto, user);

    expect(repo.create).toHaveBeenCalledWith({ ...dto, createdBy: 'u1' });
    expect(repo.save).toHaveBeenCalledWith(entity);
    expect(result).toBe(entity);
  });

  it('update sets updatedBy and saves', async () => {
    const entity = { id: '1', name: 'before' } as TestEntity;
    repo.findOne.mockResolvedValue(entity);
    repo.save.mockResolvedValue({ ...entity, name: 'after' });

    const result = await service.update('1', { name: 'after' }, {
      userId: 'u1',
    } as JwtPayload);

    expect(repo.save).toHaveBeenCalledWith({
      ...entity,
      name: 'after',
      updatedBy: 'u1',
    });
    expect(result.name).toBe('after');
  });

  it('delete sets updatedBy and saves', async () => {
    const entity = { id: '1', name: 'before' } as TestEntity;
    repo.findOne.mockResolvedValue(entity);
    repo.save.mockResolvedValue({ ...entity, updatedBy: 'u1' });

    const result = await service.delete('1', { userId: 'u1' } as JwtPayload);

    expect(repo.save).toHaveBeenCalledWith({
      ...entity,
      updatedBy: 'u1',
    });
    expect(result.updatedBy).toBe('u1');
  });

  it('hardDelete throws when not found', async () => {
    repo.findOne.mockResolvedValue(null);

    await expect(service.hardDelete('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('hardDelete removes entity', async () => {
    const entity = { id: '1' } as TestEntity;
    repo.findOne.mockResolvedValue(entity);
    repo.remove.mockResolvedValue(entity);

    const result = await service.hardDelete('1');

    expect(repo.remove).toHaveBeenCalledWith(entity);
    expect(result).toBe(entity);
  });
});
