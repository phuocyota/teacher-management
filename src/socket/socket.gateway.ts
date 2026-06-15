import { ConfigService } from '@nestjs/config';
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

type GoldenBellStudent = {
  id: string;
  name: string;
  status?: 'active' | 'passed' | 'eliminated';
  joinedAt?: string;
  lastQuestionNo?: number;
  correctCount?: number;
  wrongCount?: number;
};

type GoldenBellRoom = {
  code?: string;
  currentQuestion?: unknown;
  questionNo?: number;
  usedQuestionIds?: string[];
  students?: GoldenBellStudent[];
};

type GoldenBellJoinPayload = {
  roomId?: string;
  student?: GoldenBellStudent;
  initialRoom?: GoldenBellRoom;
};

type GoldenBellSyncPayload = {
  roomId?: string;
  room?: GoldenBellRoom;
};

@WebSocketGateway({
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || [
      'http://localhost:3001',
    ],
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

  constructor(private configService: ConfigService) {}

  afterInit(server: Server) {
    server.use((socket, next) => {
      // Thêm rate limiting
      if (!socket.handshake.auth?.token) {
        return next(new Error('Authentication error'));
      }
      next();
    });
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
  handleGoldenBellJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: GoldenBellJoinPayload,
  ) {
    if (!payload?.roomId) {
      return { ok: false, message: 'roomId is required' };
    }

    const roomName = this.getGoldenBellRoomName(payload.roomId);
    client.join(roomName);

    const currentRoom =
      this.goldenBellRooms.get(payload.roomId) ||
      payload.initialRoom ||
      this.createGoldenBellRoom(payload.roomId);

    const nextRoom = payload.student
      ? this.upsertGoldenBellStudent(currentRoom, payload.student)
      : currentRoom;

    this.goldenBellRooms.set(payload.roomId, nextRoom);
    this.server.to(roomName).emit('golden-bell:room-state', nextRoom);

    return { ok: true, room: nextRoom };
  }

  @SubscribeMessage('golden-bell:sync')
  handleGoldenBellSync(@MessageBody() payload: GoldenBellSyncPayload) {
    if (!payload?.roomId || !payload.room) {
      return { ok: false, message: 'roomId and room are required' };
    }

    const nextRoom = {
      ...this.createGoldenBellRoom(payload.roomId),
      ...payload.room,
      students: payload.room.students || [],
      usedQuestionIds: payload.room.usedQuestionIds || [],
    };

    this.goldenBellRooms.set(payload.roomId, nextRoom);
    this.server
      .to(this.getGoldenBellRoomName(payload.roomId))
      .emit('golden-bell:room-state', nextRoom);

    return { ok: true, room: nextRoom };
  }

  @SubscribeMessage('golden-bell:leave')
  handleGoldenBellLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomId?: string },
  ) {
    if (!payload?.roomId) {
      return { ok: false, message: 'roomId is required' };
    }

    client.leave(this.getGoldenBellRoomName(payload.roomId));
    return { ok: true };
  }

  private createGoldenBellRoom(roomId: string): GoldenBellRoom {
    return {
      code: roomId.slice(0, 6).toUpperCase(),
      currentQuestion: null,
      questionNo: 0,
      usedQuestionIds: [],
      students: [],
    };
  }

  private getGoldenBellRoomName(roomId: string) {
    return `golden-bell:${roomId}`;
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
        student.joinedAt || existingStudent?.joinedAt || new Date().toISOString(),
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
