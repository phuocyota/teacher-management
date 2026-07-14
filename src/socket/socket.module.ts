import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GoldenBellRoomStateEntity } from './golden-bell-room-state.entity';
import { GoldenBellRoomStateService } from './golden-bell-room-state.service';
import { SocketGateway } from './socket.gateway';

@Module({
  imports: [TypeOrmModule.forFeature([GoldenBellRoomStateEntity])],
  providers: [SocketGateway, GoldenBellRoomStateService],
  exports: [SocketGateway],
})
export class SocketModule {}
