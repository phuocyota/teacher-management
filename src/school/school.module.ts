import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SchoolController } from './school.controller';
import { SchoolService } from './school.service';
import { SchoolEntity } from './school.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SchoolEntity])],
  controllers: [SchoolController],
  providers: [SchoolService],
  exports: [SchoolService],
})
export class SchoolModule {}
