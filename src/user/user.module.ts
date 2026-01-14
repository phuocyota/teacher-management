import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from './user.entity';
import { LectureUserEntity } from 'src/lecture/entity/lecture_user.entity';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { UserGroupModule } from '../user-group/user-group.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity, LectureUserEntity]),
    UserGroupModule,
  ],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
