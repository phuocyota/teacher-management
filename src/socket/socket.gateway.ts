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

  constructor(private readonly roomStateService: GoldenBellRoomStateService) {}

  afterInit(server: Server) {
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

      const currentRoom =
        this.goldenBellRooms.get(roomId) ||
        (await this.roomStateService.find(roomId));

      if (!currentRoom) {
        return { ok: false, message: 'Room not found' };
      }

      await client.join(roomName);

      const nextRoom = payload.student
        ? this.upsertGoldenBellStudent(currentRoom, payload.student)
        : currentRoom;

      await this.roomStateService.save(roomId, nextRoom);
      this.goldenBellRooms.set(roomId, nextRoom);
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
      const currentRoom =
        this.goldenBellRooms.get(roomId) ||
        (await this.roomStateService.find(roomId));

      if (!currentRoom) {
        return { ok: false, message: 'Room not found' };
      }

      const nextRoom = {
        ...currentRoom,
        ...payload.room,
        roomId,
        code: currentRoom.code || roomId,
        questionBankId: currentRoom.questionBankId,
        students: payload.room!.students || [],
        usedQuestionIds: payload.room!.usedQuestionIds || [],
      };

      await this.roomStateService.save(roomId, nextRoom);
      this.goldenBellRooms.set(roomId, nextRoom);
      this.server
        .to(this.getGoldenBellRoomName(roomId))
        .emit('golden-bell:room-state', nextRoom);

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
    return {
      roomId,
      code: roomId,
      questionBankId,
      currentQuestion: null,
      questionNo: 0,
      usedQuestionIds: [],
      students: [],
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
    };

    return {
      ...room,
      students: existingStudent
        ? students.map((item) => (item.id === student.id ? nextStudent : item))
        : [...students, nextStudent],
    };
  }
}
