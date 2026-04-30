import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ZoneController } from './zone.controller';
import { ZoneEntity } from './zone.entity';
import { ZoneService } from './zone.service';

@Module({
  imports: [TypeOrmModule.forFeature([ZoneEntity])],
  controllers: [ZoneController],
  providers: [ZoneService],
  exports: [ZoneService],
})
export class ZoneModule {}
