import { EntityManager } from 'typeorm';

export async function runInTransaction<T>(
  entityManager: EntityManager,
  fn: (manager: EntityManager) => Promise<T>,
): Promise<T> {
  const queryRunner = entityManager.connection.createQueryRunner();

  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    const result = await fn(queryRunner.manager);
    await queryRunner.commitTransaction();
    return result;
  } catch (error) {
    await queryRunner.rollbackTransaction();
    throw error;
  } finally {
    await queryRunner.release();
  }
}
