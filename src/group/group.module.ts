import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GroupController } from './group.controller';
import { GroupService } from './group.service';
import { GroupEntity } from './entity/group.entity';
import { UserEntity } from 'src/user/user.entity';
import { GroupRepositoryService } from './services/group-repository.service';

@Module({
  imports: [TypeOrmModule.forFeature([GroupEntity, UserEntity])],
  controllers: [GroupController],
  providers: [GroupService, GroupRepositoryService],
  exports: [GroupService, GroupRepositoryService],
})
export class GroupModule {}
