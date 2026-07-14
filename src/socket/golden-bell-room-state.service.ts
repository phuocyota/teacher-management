import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GoldenBellRoomStateEntity } from './golden-bell-room-state.entity';
import type { GoldenBellRoom } from './golden-bell.types';

@Injectable()
export class GoldenBellRoomStateService {
  private readonly roomOperations = new Map<string, Promise<unknown>>();

  constructor(
    @InjectRepository(GoldenBellRoomStateEntity)
    private readonly roomStateRepository: Repository<GoldenBellRoomStateEntity>,
  ) {}

  async find(roomId: string): Promise<GoldenBellRoom | null> {
    const record = await this.roomStateRepository.findOne({
      where: { roomId },
    });

    return (record?.state as GoldenBellRoom | undefined) || null;
  }

  async save(roomId: string, state: GoldenBellRoom): Promise<void> {
    await this.roomStateRepository.upsert(
      { roomId, state },
      { conflictPaths: ['roomId'] },
    );
  }

  runExclusive<T>(roomId: string, operation: () => Promise<T>): Promise<T> {
    const previousOperation = this.roomOperations.get(roomId);
    const currentOperation = (previousOperation || Promise.resolve())
      .catch(() => undefined)
      .then(operation);

    this.roomOperations.set(roomId, currentOperation);

    return currentOperation.finally(() => {
      if (this.roomOperations.get(roomId) === currentOperation) {
        this.roomOperations.delete(roomId);
      }
    });
  }
}
