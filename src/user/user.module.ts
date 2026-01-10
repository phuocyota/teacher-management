import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from './user.entity';
import { LectureContextUserEntity } from 'src/lecture/entity/lecture_context_user.entity';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { UserGroupModule } from '../user-group/user-group.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity, LectureContextUserEntity]),
    UserGroupModule,
  ],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
