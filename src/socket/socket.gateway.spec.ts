import { SocketGateway } from './socket.gateway';
import { GoldenBellRoomStateService } from './golden-bell-room-state.service';
import { GoldenBellRoom } from './golden-bell.types';
import { Socket } from 'socket.io';
import * as jwt from 'jsonwebtoken';

describe('Golden Bell revival', () => {
  let gateway: SocketGateway;
  let room: GoldenBellRoom;
  let save: jest.Mock;
  let emit: jest.Mock;
  const client = (userType = 'TEACHER') =>
    ({
      handshake: {
        auth: {
          token: jwt.sign({ userType }, process.env.JWT_SECRET || 'secretKey'),
        },
      },
      rooms: new Set(['golden-bell:123456']),
      join: jest.fn(),
    }) as unknown as Socket;

  beforeEach(() => {
    jest.useFakeTimers();
    room = {
      roomId: '123456',
      status: 'RUNNING',
      questionNo: 2,
      currentQuestion: { id: 'q2' },
      questionStartedAt: new Date().toISOString(),
      questionDurationSeconds: 15,
      students: [
        {
          id: 'out',
          name: 'Out',
          status: 'eliminated',
          lastQuestionNo: 2,
          correctCount: 1,
          wrongCount: 1,
          eliminatedReason: 'wrong-answer',
        },
        { id: 'other', name: 'Other', status: 'active', lastQuestionNo: 0 },
      ],
    };
    save = jest.fn(async (_id, next) => {
      room = next;
    });
    emit = jest.fn();
    gateway = new SocketGateway({
      find: jest.fn(async () => room),
      save,
      runExclusive: async (_id, operation) => operation(),
    } as unknown as GoldenBellRoomStateService);
    gateway.server = { to: jest.fn(() => ({ emit })) } as never;
  });
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });
  const revive = (socket = client(), studentId = 'out') =>
    gateway.handleGoldenBellReviveStudent(socket, {
      roomId: '123456',
      studentId,
    });

  it('persists and broadcasts revival for the next question, retaining scores', async () => {
    const other = room.students![1];
    expect((await revive()).ok).toBe(true);
    expect(room.students![0]).toMatchObject({
      status: 'active',
      lastQuestionNo: 2,
      resumeFromQuestionNo: 3,
      revivalCount: 1,
      correctCount: 1,
      wrongCount: 1,
      eliminatedReason: null,
    });
    expect(room.students![1]).toBe(other);
    expect(save).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith('golden-bell:room-state', room);
    expect((await revive()).ok).toBe(false);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('skips the old timeout and permits answering the next question', async () => {
    await revive();
    await jest.advanceTimersByTimeAsync(15000);
    expect(room.students![0].status).toBe('active');
    expect(room.students![1].status).toBe('eliminated');
    const next = {
      ...room,
      questionNo: 3,
      currentQuestion: { id: 'q3' },
      questionStartedAt: new Date().toISOString(),
      questionEndedAt: null,
      students: room.students!.map((s) =>
        s.id === 'out' ? { ...s, lastQuestionNo: 0 } : s,
      ),
    };
    await gateway.handleGoldenBellSync({ roomId: '123456', room: next });
    await gateway.handleGoldenBellSync({
      roomId: '123456',
      room: {
        ...room,
        students: room.students!.map((s) =>
          s.id === 'out'
            ? { ...s, status: 'passed', lastQuestionNo: 3, correctCount: 2 }
            : s,
        ),
      },
    });
    expect(room.students![0].status).toBe('passed');
  });

  it('times a revived student out normally when they do not answer the next question', async () => {
    await revive();
    await gateway.handleGoldenBellSync({
      roomId: '123456',
      room: {
        ...room,
        questionNo: 3,
        currentQuestion: { id: 'q3' },
        questionStartedAt: new Date().toISOString(),
      },
    });
    await jest.advanceTimersByTimeAsync(15000);
    expect(room.students![0]).toMatchObject({
      status: 'eliminated',
      lastQuestionNo: 3,
      eliminatedReason: 'timeout',
    });
  });

  it('ignores stale sync and reconnect snapshots after revival', async () => {
    const stale = structuredClone(room);
    await revive();
    await gateway.handleGoldenBellSync({ roomId: '123456', room: stale });
    expect(room.students![0].status).toBe('active');
    await gateway.handleGoldenBellJoin(client(), {
      roomId: '123456',
      student: stale.students![0],
    });
    expect(room.students![0]).toMatchObject({
      status: 'active',
      revivalCount: 1,
      resumeFromQuestionNo: 3,
    });
    const answer = {
      ...room,
      students: room.students!.map((s) => ({
        ...s,
        status: 'passed' as const,
      })),
    };
    await gateway.handleGoldenBellSync({ roomId: '123456', room: answer });
    expect(room.students![0].status).toBe('active');
  });

  it('rejects invalid credentials, students and sockets outside the room', async () => {
    expect((await revive(client('STUDENT'))).ok).toBe(false);
    const invalid = client();
    invalid.handshake.auth.token = 'invalid';
    expect((await revive(invalid)).ok).toBe(false);
    const outsider = client();
    outsider.rooms.clear();
    expect((await revive(outsider)).ok).toBe(false);
    expect((await revive(client(), 'missing')).ok).toBe(false);
    expect(save).not.toHaveBeenCalled();
  });

  it.each(['FINISHED', 'EXPIRED'] as const)(
    'rejects a %s room',
    async (status) => {
      room.status = status;
      expect((await revive()).ok).toBe(false);
      expect(save).not.toHaveBeenCalled();
    },
  );

  it('does not broadcast success if persistence fails', async () => {
    save.mockRejectedValueOnce(new Error('database unavailable'));
    await expect(revive()).rejects.toThrow('database unavailable');
    expect(emit).not.toHaveBeenCalled();
  });
});
