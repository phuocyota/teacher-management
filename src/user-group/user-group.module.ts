import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserGroupController } from './user-group.controller';
import { UserGroupService } from './user-group.service';
import { UserGroupEntity } from './entity/user-group.entity';
import { UserEntity } from '../user/user.entity';
import { GroupEntity } from '../group/entity/group.entity';
import { UserRepositoryService } from '../user/user-repository.service';
import { GroupRepositoryService } from '../group/services/group-repository.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserGroupEntity, UserEntity, GroupEntity]),
  ],
  controllers: [UserGroupController],
  providers: [UserGroupService, UserRepositoryService, GroupRepositoryService],
  exports: [UserGroupService],
})
export class UserGroupModule {}
