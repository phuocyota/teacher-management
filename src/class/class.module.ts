import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClassEntity } from './class.entity';
import { ClassService } from './class.service';
import { ClassController } from './class.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ClassEntity])],
  controllers: [ClassController],
  providers: [ClassService],
})
export class ClassModule {}
