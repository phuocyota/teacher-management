import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { FileEntity } from './entity/file.entity';
import { FileAccessEntity } from './entity/file-access.entity';
import { LectureEntity } from 'src/lecture/entity/lecture.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([FileEntity, FileAccessEntity, LectureEntity]),
  ],
  controllers: [UploadController],
  providers: [UploadService],
  exports: [UploadService],
})
export class UploadModule {}
