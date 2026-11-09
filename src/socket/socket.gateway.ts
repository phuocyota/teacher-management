import 'dotenv/config';
import { randomInt } from 'node:crypto';
import * as jwt from 'jsonwebtoken';
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
  GoldenBellReviveStudentPayload,
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
  private readonly goldenBellPodiumResults = new Map<string, GoldenBellRoom>();
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

      if (currentRoom.status === 'FINISHED') {
        await client.join(roomName);
        const result = this.goldenBellPodiumResults.get(roomId);
        this.scheduleRoomExpiry(roomId, currentRoom);
        const hasPodiumResult = Boolean(
          result && result.endedAt === currentRoom.endedAt,
        );
        return {
          ok: true,
          room: hasPodiumResult ? result! : currentRoom,
          hasPodiumResult,
        };
      }
      if (currentRoom.status === 'EXPIRED') {
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

        // Revival belongs to the server. Ignore snapshots sent before it was committed,
        // and do not accept answers for the round the revived student must skip.
        if (
          !isRoomReset &&
          currentStudent &&
          ((student.revivalCount || 0) !== (currentStudent.revivalCount || 0) ||
            (currentStudent.resumeFromQuestionNo || 0) >
              (payload.room!.questionNo || 0))
        ) {
          return currentStudent;
        }

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

        return isRoomReset
          ? {
              ...student,
              resumeFromQuestionNo: 0,
              revivalCount: 0,
              revivedAt: undefined,
            }
          : {
              ...student,
              resumeFromQuestionNo: currentStudent?.resumeFromQuestionNo,
              revivalCount: currentStudent?.revivalCount,
              revivedAt: currentStudent?.revivedAt,
            };
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

  // Rankings and the edit window are handled by the teacher frontend.
  // This event only relays the finished result and keeps it for reconnecting viewers.
  @SubscribeMessage('golden-bell:podium-result')
  async handleGoldenBellPodiumResult(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: {
      roomId?: string;
      endedAt?: string;
      selections?: Record<string, string | null>;
    },
  ) {
    try {
      const claims = jwt.verify(
        client.handshake.auth?.token,
        process.env.JWT_SECRET || 'secretKey',
        { algorithms: ['HS256'] },
      );
      if (typeof claims === 'string' || claims.userType !== 'TEACHER') {
        return { ok: false, message: 'Chỉ giáo viên được gửi kết quả.' };
      }
    } catch {
      return { ok: false, message: 'Phiên đăng nhập giáo viên không hợp lệ.' };
    }
    if (
      typeof payload?.roomId !== 'string' ||
      !payload.roomId.trim() ||
      !payload.selections ||
      typeof payload.selections !== 'object' ||
      Array.isArray(payload.selections)
    ) {
      return { ok: false, message: 'Kết quả không hợp lệ.' };
    }
    const roomId = this.normalizeRoomId(payload.roomId);
    if (!client.rooms.has(this.getGoldenBellRoomName(roomId))) {
      return { ok: false, message: 'Cần kết nối phòng để gửi kết quả.' };
    }
    return this.roomStateService.runExclusive(roomId, async () => {
      const room =
        this.goldenBellRooms.get(roomId) ||
        (await this.roomStateService.find(roomId));
      if (
        !room ||
        room.status !== 'FINISHED' ||
        !room.endedAt ||
        payload.endedAt !== room.endedAt ||
        this.isRoomExpired(room)
      ) {
        return {
          ok: false,
          message:
            'Sàn đấu chưa kết thúc hoặc kết quả không thuộc phiên thi này.',
        };
      }
      const selections: Record<string, string | null> = {};
      const used = new Set<string>();
      for (const [rank, id] of Object.entries(payload.selections!)) {
        if (
          !['1', '2', '3'].includes(rank) ||
          (id !== null &&
            (typeof id !== 'string' ||
              used.has(id) ||
              !room.students?.some((s) => s.id === id)))
        ) {
          return { ok: false, message: 'Kết quả không hợp lệ.' };
        }
        selections[rank] = id;
        if (id) used.add(id);
      }
      const result = { ...room, podiumSelections: selections };
      this.goldenBellPodiumResults.set(roomId, result);
      this.server
        .to(this.getGoldenBellRoomName(roomId))
        .emit('golden-bell:podium-result', { roomId, room: result });
      return { ok: true, room: result };
    });
  }

  @SubscribeMessage('golden-bell:revive-student')
  async handleGoldenBellReviveStudent(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: GoldenBellReviveStudentPayload,
  ) {
    if (
      typeof payload?.roomId !== 'string' ||
      !payload.roomId.trim() ||
      typeof payload?.studentId !== 'string' ||
      !payload.studentId.trim()
    ) {
      return { ok: false, message: 'roomId and studentId are required' };
    }
    try {
      const claims = jwt.verify(
        client.handshake.auth?.token,
        process.env.JWT_SECRET || 'secretKey',
        { algorithms: ['HS256'] },
      );
      if (typeof claims === 'string' || claims.userType !== 'TEACHER') {
        return { ok: false, message: 'Teacher authentication is required' };
      }
    } catch {
      return { ok: false, message: 'Teacher authentication is required' };
    }

    const roomId = this.normalizeRoomId(payload.roomId);
    if (!client.rooms.has(this.getGoldenBellRoomName(roomId))) {
      return { ok: false, message: 'Join the room before reviving a student' };
    }
    return this.roomStateService.runExclusive(roomId, async () => {
      const storedRoom =
        this.goldenBellRooms.get(roomId) ||
        (await this.roomStateService.find(roomId));
      if (!storedRoom) return { ok: false, message: 'Room not found' };
      const room = this.ensureRoomLifecycle(storedRoom);
      if (this.isRoomExpired(room)) {
        await this.expireRoom(roomId);
        return { ok: false, message: 'Room expired' };
      }
      if (room.status === 'FINISHED' || room.status === 'EXPIRED') {
        return { ok: false, message: 'Room has ended' };
      }
      const student = room.students?.find(
        (item) => item.id === payload.studentId,
      );
      if (!student) return { ok: false, message: 'Student not found' };
      if (student.status !== 'eliminated') {
        return {
          ok: false,
          message: 'Only eliminated students can be revived',
        };
      }
      const questionNo = room.questionNo || 0;
      const nextRoom: GoldenBellRoom = {
        ...room,
        podiumSelections: {},
        students: room.students!.map((item) =>
          item.id !== student.id
            ? item
            : {
                ...item,
                status: 'active',
                lastQuestionNo: questionNo,
                resumeFromQuestionNo: questionNo + 1,
                eliminatedAt: null,
                eliminatedQuestionNo: null,
                eliminatedReason: null,
                revivedAt: new Date().toISOString(),
                revivalCount: (item.revivalCount || 0) + 1,
              },
        ),
      };
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
      if (currentRoom.status === 'FINISHED') {
        return {
          ok: true,
          room: this.goldenBellPodiumResults.get(roomId) || currentRoom,
        };
      }
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
        ? students.map((item) =>
            item.id === student.id
              ? { ...nextStudent, ...existingStudent }
              : item,
          )
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
    this.goldenBellPodiumResults.delete(roomId);
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
            (student.resumeFromQuestionNo || 0) <= questionNo &&
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
