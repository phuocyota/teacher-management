import { Module, BadRequestException } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { FileEntity } from './entity/file.entity';
import { FileAccessEntity } from './entity/file-access.entity';
import { LectureEntity } from 'src/lecture/entity/lecture.entity';

// Interface cho Multer File (để tránh lặp lại)
interface MulterFile {
  originalname: string;
  mimetype: string;
}

@Module({
  imports: [
    TypeOrmModule.forFeature([FileEntity, FileAccessEntity, LectureEntity]),
    MulterModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const uploadDir = configService.get<string>('UPLOAD_DIR', 'uploads');

        return {
          storage: diskStorage({
            destination: uploadDir,
            filename: (
              _req: unknown,
              file: MulterFile,
              callback: (error: Error | null, filename: string) => void,
            ) => {
              const uniqueSuffix =
                Date.now() + '-' + Math.round(Math.random() * 1e9);
              const ext = extname(file.originalname);
              const filename = `${uniqueSuffix}${ext}`;
              callback(null, filename);
            },
          }),
          fileFilter: (
            _req: unknown,
            file: MulterFile,
            callback: (error: Error | null, acceptFile: boolean) => void,
          ) => {
            const allowedMimes = [
              'image/jpeg',
              'image/png',
              'image/gif',
              'image/webp',
              'application/pdf',
              'application/msword',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              'application/vnd.ms-excel',
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              'application/vnd.ms-powerpoint',
              'application/vnd.openxmlformats-officedocument.presentationml.presentation',
              'text/plain',
              'application/zip',
              'application/x-rar-compressed',
              'video/mp4',
              'video/mpeg',
              'video/quicktime',
              'video/webm',
              'video/x-msvideo',
              'audio/mpeg',
              'audio/wav',
              'audio/ogg',
              'audio/aac',
            ];

            if (allowedMimes.includes(file.mimetype)) {
              callback(null, true);
            } else {
              callback(
                new BadRequestException(
                  `Loại file không được hỗ trợ: ${file.mimetype}.`,
                ),
                false,
              );
            }
          },
          limits: {
            fileSize: 500 * 1024 * 1024, // 500MB
          },
        };
      },
    }),
  ],
  controllers: [UploadController],
  providers: [UploadService],
  exports: [UploadService],
})
export class UploadModule {}
