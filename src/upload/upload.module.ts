import { Module, BadRequestException } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { mkdirSync, existsSync } from 'fs';
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
            destination: (
              _req: unknown,
              file: MulterFile,
              callback: (error: Error | null, destination: string) => void,
            ) => {
              try {
                const raw = (file.originalname || '').replace(/\\\\/g, '/');
                const dirPart = raw.includes('/')
                  ? raw.split('/').slice(0, -1).join('/')
                  : '';
                // Prevent path traversal by removing '..'
                const safeDir = dirPart
                  .split('/')
                  .filter((p) => p && p !== '..')
                  .join('/');
                const dest = safeDir ? join(uploadDir, safeDir) : uploadDir;
                try {
                  mkdirSync(dest, { recursive: true });
                } catch (e) {
                  // ignore
                }
                callback(null, dest);
              } catch (e) {
                callback(e as any, uploadDir);
              }
            },
            filename: (
              _req: unknown,
              file: MulterFile,
              callback: (error: Error | null, filename: string) => void,
            ) => {
              try {
                let raw = (file.originalname || '').replace(/\\\\/g, '/');
                // attempt to fix common mojibake (latin1 interpreted as utf8)
                if (/[ÃÂÄ]/.test(raw)) {
                  try {
                    raw = Buffer.from(raw, 'latin1').toString('utf8');
                  } catch (err) {
                    // ignore conversion errors
                  }
                }
                const base = raw.split('/').filter(Boolean).pop() || 'file';
                const safeName = base.replace(/[<>:\\"/\\|?*]+/g, '_').trim();
                callback(null, safeName);
              } catch (e) {
                callback(null, 'file');
              }
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
              'application/x-zip-compressed',
              'application/octet-stream',
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
