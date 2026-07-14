import 'dotenv/config';
import { randomInt } from 'node:crypto';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GoldenBellRoomStateService } from './golden-bell-room-state.service';
import type {
  GoldenBellCreateRoomPayload,
  GoldenBellEndRoomPayload,
  GoldenBellJoinPayload,
  GoldenBellRoom,
  GoldenBellStudent,
  GoldenBellSyncPayload,
} from './golden-bell.types';

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
      .map((origin) => origin.trim().replace(/\/$/, ''))
      .filter(Boolean)
  : [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://160.250.132.143:5173',
      'https://fe.kidostudent.kidoedu.vn',
      'https://kidostudent.kidoedu.vn',
    ];

const DEFAULT_QUESTION_DURATION_SECONDS = 15;
const ROOM_LIFETIME_MS = 24 * 60 * 60 * 1000;
const ROOM_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

@WebSocketGateway({
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  maxHttpBufferSize: 1e6, // 1MB limit
})
export class SocketGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly goldenBellRooms = new Map<string, GoldenBellRoom>();
  private readonly questionTimers = new Map<
    string,
    { questionKey: string; timer: ReturnType<typeof setTimeout> }
  >();
  private readonly roomExpiryTimers = new Map<
    string,
    ReturnType<typeof setTimeout>
  >();

  constructor(private readonly roomStateService: GoldenBellRoomStateService) {}

  afterInit(server: Server) {
    void this.roomStateService.removeExpired();
    setInterval(() => {
      void this.roomStateService.removeExpired();
    }, ROOM_CLEANUP_INTERVAL_MS);

    server.use((socket, next) => {
      // Thêm rate limiting
      if (!socket.handshake.auth?.token) {
        return next(new Error('Authentication error'));
      }
      next();
    });
  }

  @SubscribeMessage('golden-bell:create-room')
  async handleGoldenBellCreateRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: GoldenBellCreateRoomPayload,
  ) {
    if (!payload?.questionBankId) {
      return { ok: false, message: 'questionBankId is required' };
    }

    if (client.handshake.auth?.token === 'guest') {
      return { ok: false, message: 'Teacher authentication is required' };
    }

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const roomId = String(randomInt(100000, 1000000));
      const room = await this.roomStateService.runExclusive(
        roomId,
        async () => {
          const existingRoom =
            this.goldenBellRooms.get(roomId) ||
            (await this.roomStateService.find(roomId));

          if (existingRoom) {
            return null;
          }

          const nextRoom = this.createGoldenBellRoom(
            roomId,
            payload.questionBankId,
          );
          await this.roomStateService.save(roomId, nextRoom);
          this.goldenBellRooms.set(roomId, nextRoom);
          return nextRoom;
        },
      );

      if (!room) {
        continue;
      }

      await client.join(this.getGoldenBellRoomName(roomId));
      this.scheduleRoomExpiry(roomId, room);
      this.server
        .to(this.getGoldenBellRoomName(roomId))
        .emit('golden-bell:room-state', room);
      return { ok: true, roomId, room };
    }

    return { ok: false, message: 'Could not generate a unique room code' };
  }

  handleConnection(client: Socket) {
    console.log('Client connected: ' + client.id);
    // Giới hạn số lượng kết nối
    if (this.server.engine.clientsCount > 10000) {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    console.log('Client disconnected: ' + client.id);
  }

  @SubscribeMessage('golden-bell:join')
  async handleGoldenBellJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: GoldenBellJoinPayload,
  ) {
    if (!payload?.roomId) {
      return { ok: false, message: 'roomId is required' };
    }

    const roomId = this.normalizeRoomId(payload.roomId);

    return this.roomStateService.runExclusive(roomId, async () => {
      const roomName = this.getGoldenBellRoomName(roomId);

      const storedRoom =
        this.goldenBellRooms.get(roomId) ||
        (await this.roomStateService.find(roomId));

      if (!storedRoom) {
        return { ok: false, message: 'Room not found' };
      }

      const currentRoom = this.ensureRoomLifecycle(storedRoom);
      if (this.isRoomExpired(currentRoom)) {
        await this.expireRoom(roomId);
        return { ok: false, message: 'Room expired' };
      }

      if (
        currentRoom.status === 'FINISHED' ||
        currentRoom.status === 'EXPIRED'
      ) {
        return { ok: false, message: 'Room has ended' };
      }

      await client.join(roomName);

      const roomWithTiming = this.ensureQuestionTiming(currentRoom);
      const nextRoom = payload.student
        ? this.upsertGoldenBellStudent(roomWithTiming, payload.student)
        : roomWithTiming;

      await this.roomStateService.save(roomId, nextRoom);
      this.goldenBellRooms.set(roomId, nextRoom);
      this.scheduleQuestionTimeout(roomId, nextRoom);
      this.scheduleRoomExpiry(roomId, nextRoom);
      this.server.to(roomName).emit('golden-bell:room-state', nextRoom);

      return { ok: true, room: nextRoom };
    });
  }

  @SubscribeMessage('golden-bell:sync')
  async handleGoldenBellSync(@MessageBody() payload: GoldenBellSyncPayload) {
    if (!payload?.roomId || !payload.room) {
      return { ok: false, message: 'roomId and room are required' };
    }

    const roomId = this.normalizeRoomId(payload.roomId);

    return this.roomStateService.runExclusive(roomId, async () => {
      const storedRoom =
        this.goldenBellRooms.get(roomId) ||
        (await this.roomStateService.find(roomId));

      if (!storedRoom) {
        return { ok: false, message: 'Room not found' };
      }

      const currentRoom = this.ensureRoomLifecycle(storedRoom);
      if (this.isRoomExpired(currentRoom)) {
        await this.expireRoom(roomId);
        return { ok: false, message: 'Room expired' };
      }

      if (
        currentRoom.status === 'FINISHED' ||
        currentRoom.status === 'EXPIRED'
      ) {
        return { ok: false, message: 'Room has ended' };
      }

      const isRoomReset =
        Boolean(currentRoom.currentQuestion) && !payload.room!.currentQuestion;
      const isSameQuestion =
        this.getQuestionId(currentRoom.currentQuestion) ===
          this.getQuestionId(payload.room!.currentQuestion) &&
        currentRoom.questionNo === payload.room!.questionNo;
      const requestedStudents = payload.room!.students || [];
      const nextStudents = requestedStudents.map((student) => {
        const currentStudent = currentRoom.students?.find(
          (item) => item.id === student.id,
        );

        if (
          !isRoomReset &&
          isSameQuestion &&
          currentStudent &&
          (currentStudent.status === 'eliminated' ||
            (currentStudent.status === 'passed' && student.status === 'active'))
        ) {
          return {
            ...student,
            status: currentStudent.status,
            lastQuestionNo: currentStudent.lastQuestionNo,
            eliminatedReason: currentStudent.eliminatedReason,
          };
        }

        return student;
      });

      const nextRoom = this.ensureQuestionTiming({
        ...currentRoom,
        ...payload.room,
        roomId,
        code: currentRoom.code || roomId,
        questionBankId: currentRoom.questionBankId,
        status: payload.room!.currentQuestion ? 'RUNNING' : 'WAITING',
        createdAt: currentRoom.createdAt,
        expiresAt: currentRoom.expiresAt,
        endedAt: null,
        students: nextStudents,
        usedQuestionIds: payload.room!.usedQuestionIds || [],
        questionEndedAt:
          isSameQuestion && currentRoom.questionEndedAt
            ? currentRoom.questionEndedAt
            : payload.room!.questionEndedAt,
      });

      await this.roomStateService.save(roomId, nextRoom);
      this.goldenBellRooms.set(roomId, nextRoom);
      this.scheduleQuestionTimeout(roomId, nextRoom);
      this.scheduleRoomExpiry(roomId, nextRoom);
      this.server
        .to(this.getGoldenBellRoomName(roomId))
        .emit('golden-bell:room-state', nextRoom);

      return { ok: true, room: nextRoom };
    });
  }

  @SubscribeMessage('golden-bell:end-room')
  async handleGoldenBellEndRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: GoldenBellEndRoomPayload,
  ) {
    if (!payload?.roomId) {
      return { ok: false, message: 'roomId is required' };
    }

    if (client.handshake.auth?.token === 'guest') {
      return { ok: false, message: 'Teacher authentication is required' };
    }

    const roomId = this.normalizeRoomId(payload.roomId);

    return this.roomStateService.runExclusive(roomId, async () => {
      const storedRoom =
        this.goldenBellRooms.get(roomId) ||
        (await this.roomStateService.find(roomId));

      if (!storedRoom) {
        return { ok: false, message: 'Room not found' };
      }

      const currentRoom = this.ensureRoomLifecycle(storedRoom);
      const nextRoom: GoldenBellRoom = {
        ...currentRoom,
        status: 'FINISHED',
        endedAt: new Date().toISOString(),
        questionEndedAt:
          currentRoom.questionEndedAt || new Date().toISOString(),
      };

      await this.roomStateService.save(roomId, nextRoom);
      this.goldenBellRooms.set(roomId, nextRoom);
      this.clearQuestionTimer(roomId);
      this.scheduleRoomExpiry(roomId, nextRoom);
      this.server
        .to(this.getGoldenBellRoomName(roomId))
        .emit('golden-bell:room-state', nextRoom);
      this.server
        .to(this.getGoldenBellRoomName(roomId))
        .emit('golden-bell:room-closed', { roomId, reason: 'FINISHED' });

      return { ok: true, room: nextRoom };
    });
  }

  @SubscribeMessage('golden-bell:leave')
  handleGoldenBellLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomId?: string },
  ) {
    if (!payload?.roomId) {
      return { ok: false, message: 'roomId is required' };
    }

    void client.leave(
      this.getGoldenBellRoomName(this.normalizeRoomId(payload.roomId)),
    );
    return { ok: true };
  }

  private createGoldenBellRoom(
    roomId: string,
    questionBankId?: string,
  ): GoldenBellRoom {
    const now = Date.now();

    return {
      roomId,
      code: roomId,
      questionBankId,
      currentQuestion: null,
      questionNo: 0,
      usedQuestionIds: [],
      students: [],
      status: 'WAITING',
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + ROOM_LIFETIME_MS).toISOString(),
      endedAt: null,
    };
  }

  private getGoldenBellRoomName(roomId: string) {
    return `golden-bell:${roomId}`;
  }

  private normalizeRoomId(roomId: string) {
    return roomId.trim().toUpperCase();
  }

  private upsertGoldenBellStudent(
    room: GoldenBellRoom,
    student: GoldenBellStudent,
  ): GoldenBellRoom {
    const students = room.students || [];
    const existingStudent = students.find((item) => item.id === student.id);
    const nextStudent = {
      ...existingStudent,
      ...student,
      status: student.status || existingStudent?.status || 'active',
      joinedAt:
        student.joinedAt ||
        existingStudent?.joinedAt ||
        new Date().toISOString(),
      lastQuestionNo:
        student.lastQuestionNo ?? existingStudent?.lastQuestionNo ?? 0,
      correctCount: student.correctCount ?? existingStudent?.correctCount ?? 0,
      wrongCount: student.wrongCount ?? existingStudent?.wrongCount ?? 0,
      eliminatedReason:
        student.eliminatedReason ?? existingStudent?.eliminatedReason,
    };

    return {
      ...room,
      students: existingStudent
        ? students.map((item) => (item.id === student.id ? nextStudent : item))
        : [...students, nextStudent],
    };
  }

  private ensureRoomLifecycle(room: GoldenBellRoom): GoldenBellRoom {
    const createdAt = Date.parse(room.createdAt || '');
    const normalizedCreatedAt = Number.isFinite(createdAt)
      ? createdAt
      : Date.now();
    const expiresAt = Date.parse(room.expiresAt || '');

    return {
      ...room,
      status: room.status || (room.currentQuestion ? 'RUNNING' : 'WAITING'),
      createdAt: new Date(normalizedCreatedAt).toISOString(),
      expiresAt: new Date(
        Number.isFinite(expiresAt)
          ? expiresAt
          : normalizedCreatedAt + ROOM_LIFETIME_MS,
      ).toISOString(),
      endedAt: room.endedAt || null,
    };
  }

  private isRoomExpired(room: GoldenBellRoom): boolean {
    const expiresAt = Date.parse(room.expiresAt || '');
    return Number.isFinite(expiresAt) && expiresAt <= Date.now();
  }

  private scheduleRoomExpiry(roomId: string, room: GoldenBellRoom): void {
    const expiresAt = Date.parse(room.expiresAt || '');
    if (!Number.isFinite(expiresAt)) return;

    this.clearRoomExpiryTimer(roomId);
    const timer = setTimeout(
      () => {
        void this.roomStateService.runExclusive(roomId, () =>
          this.expireRoom(roomId),
        );
      },
      Math.max(0, expiresAt - Date.now()),
    );

    this.roomExpiryTimers.set(roomId, timer);
  }

  private async expireRoom(roomId: string): Promise<void> {
    const storedRoom =
      this.goldenBellRooms.get(roomId) ||
      (await this.roomStateService.find(roomId));

    if (!storedRoom) {
      this.clearRoomExpiryTimer(roomId);
      return;
    }

    const room = this.ensureRoomLifecycle(storedRoom);
    if (!this.isRoomExpired(room)) {
      this.scheduleRoomExpiry(roomId, room);
      return;
    }

    const expiredRoom: GoldenBellRoom = {
      ...room,
      status: 'EXPIRED',
      endedAt: room.endedAt || new Date().toISOString(),
      questionEndedAt: room.questionEndedAt || new Date().toISOString(),
    };
    const roomName = this.getGoldenBellRoomName(roomId);

    this.server.to(roomName).emit('golden-bell:room-state', expiredRoom);
    this.server
      .to(roomName)
      .emit('golden-bell:room-closed', { roomId, reason: 'EXPIRED' });
    this.server.in(roomName).socketsLeave(roomName);
    this.goldenBellRooms.delete(roomId);
    this.clearQuestionTimer(roomId);
    this.clearRoomExpiryTimer(roomId);
    await this.roomStateService.remove(roomId);
  }

  private clearRoomExpiryTimer(roomId: string): void {
    const timer = this.roomExpiryTimers.get(roomId);
    if (!timer) return;

    clearTimeout(timer);
    this.roomExpiryTimers.delete(roomId);
  }

  private scheduleQuestionTimeout(roomId: string, room: GoldenBellRoom): void {
    const questionId = this.getQuestionId(room.currentQuestion);
    const startedAt = Date.parse(room.questionStartedAt || '');

    if (!questionId || !Number.isFinite(startedAt) || room.questionEndedAt) {
      this.clearQuestionTimer(roomId);
      return;
    }

    const durationSeconds =
      room.questionDurationSeconds || DEFAULT_QUESTION_DURATION_SECONDS;
    const questionKey = `${questionId}:${room.questionNo || 0}:${startedAt}`;
    const existingTimer = this.questionTimers.get(roomId);

    if (existingTimer?.questionKey === questionKey) {
      return;
    }

    this.clearQuestionTimer(roomId);

    const delay = Math.max(0, startedAt + durationSeconds * 1000 - Date.now());
    const timer = setTimeout(() => {
      void this.eliminateUnansweredStudents(roomId, questionKey);
    }, delay);

    this.questionTimers.set(roomId, { questionKey, timer });
  }

  private ensureQuestionTiming(room: GoldenBellRoom): GoldenBellRoom {
    if (!room.currentQuestion || room.questionEndedAt) {
      return room;
    }

    const startedAt = Date.parse(room.questionStartedAt || '');
    if (Number.isFinite(startedAt)) {
      return room;
    }

    return {
      ...room,
      questionStartedAt: new Date().toISOString(),
      questionDurationSeconds:
        room.questionDurationSeconds || DEFAULT_QUESTION_DURATION_SECONDS,
      questionEndedAt: null,
    };
  }

  private async eliminateUnansweredStudents(
    roomId: string,
    questionKey: string,
  ): Promise<void> {
    try {
      await this.roomStateService.runExclusive(roomId, async () => {
        const currentRoom =
          this.goldenBellRooms.get(roomId) ||
          (await this.roomStateService.find(roomId));

        if (!currentRoom || this.getQuestionKey(currentRoom) !== questionKey) {
          return;
        }

        const questionNo = currentRoom.questionNo || 0;
        const students = (currentRoom.students || []).map((student) => {
          if (
            student.status === 'active' &&
            student.lastQuestionNo !== questionNo
          ) {
            return {
              ...student,
              status: 'eliminated' as const,
              eliminatedReason: 'timeout' as const,
              lastQuestionNo: questionNo,
            };
          }

          return student;
        });
        const nextRoom: GoldenBellRoom = {
          ...currentRoom,
          students,
          questionEndedAt: new Date().toISOString(),
        };

        await this.roomStateService.save(roomId, nextRoom);
        this.goldenBellRooms.set(roomId, nextRoom);
        this.server
          .to(this.getGoldenBellRoomName(roomId))
          .emit('golden-bell:room-state', nextRoom);
      });
    } finally {
      const timer = this.questionTimers.get(roomId);
      if (timer?.questionKey === questionKey) {
        this.questionTimers.delete(roomId);
      }
    }
  }

  private getQuestionKey(room: GoldenBellRoom): string {
    return `${this.getQuestionId(room.currentQuestion)}:${room.questionNo || 0}:${Date.parse(room.questionStartedAt || '')}`;
  }

  private getQuestionId(question: unknown): string {
    if (!question || typeof question !== 'object' || !('id' in question)) {
      return '';
    }

    const id = question.id;
    return typeof id === 'string' || typeof id === 'number' ? String(id) : '';
  }

  private clearQuestionTimer(roomId: string): void {
    const existingTimer = this.questionTimers.get(roomId);
    if (!existingTimer) return;

    clearTimeout(existingTimer.timer);
    this.questionTimers.delete(roomId);
  }
}
