import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UserModule } from 'src/user/user.module';
import { TokenEntity } from './token.entity';
import { StudentRegistrationController } from './student-registration.controller';
import { StudentRegistrationService } from './student-registration.service';

@Module({
  imports: [UserModule, TypeOrmModule.forFeature([TokenEntity])],
  controllers: [AuthController, StudentRegistrationController],
  providers: [AuthService, StudentRegistrationService],
  exports: [AuthService],
})
export class AuthModule {}
