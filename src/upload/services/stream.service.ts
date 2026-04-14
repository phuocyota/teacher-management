import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { existsSync, createReadStream, statSync } from 'fs';
import { isAbsolute, normalize, join } from 'path';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { FileEntity } from '../entity/file.entity';

@Injectable()
export class StreamService {
  private readonly uploadDir: string;

  constructor(
    @InjectRepository(FileEntity)
    private readonly fileRepo: Repository<FileEntity>,
    private readonly configService: ConfigService,
  ) {
    this.uploadDir = this.configService.get('UPLOAD_DIR') || 'uploads';
  }

  /**
   * Download file with attachment disposition
   */
  async download(fileId: string, res: Response) {
    // 1️⃣ Lấy metadata file
    const file = await this.fileRepo.findOne({ where: { id: fileId } });

    if (!file) throw new NotFoundException('File not found');

    // 2️⃣ Build local absolute path and validate
    const absolutePath = this.getAbsoluteFilePathInternal(file.path);
    if (!existsSync(absolutePath)) {
      throw new NotFoundException('File not found on storage');
    }

    const stats = statSync(absolutePath);
    if (stats.isDirectory()) {
      throw new BadRequestException('Downloading directories is not supported');
    }

    // 3️⃣ Set headers and stream file
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(file.originalName)}"`,
    );
    res.setHeader('Content-Type', file.mimetype || 'application/octet-stream');
    res.setHeader('Content-Length', stats.size.toString());

    const stream = createReadStream(absolutePath);
    stream.on('error', (err) => {
      res.status(500).end();
    });
    stream.pipe(res);
  }

  /**
   * Serve image file with appropriate content-type
   */
  async serveImage(filename: string, res: Response) {
    const file = await this.fileRepo.findOne({ where: { filename } });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    const absolutePath = this.getAbsoluteFilePath(file.path);
    if (!existsSync(absolutePath)) {
      throw new NotFoundException('File not found on storage');
    }

    const stats = statSync(absolutePath);
    if (stats.isDirectory()) {
      throw new BadRequestException('Cannot serve a directory');
    }

    // Use sendFile for better performance and automatic content-type handling
    res.sendFile(absolutePath, {
      headers: {
        'Content-Type': file.mimetype,
        'Cache-Control': 'public, max-age=31536000',
      },
    });
  }

  /**
   * Stream file with support for Range requests (partial content)
   */
  async stream(fileId: string, req: Request, res: Response) {
    const file = await this.fileRepo.findOne({ where: { id: fileId } });

    if (!file) throw new NotFoundException('File not found');

    const absolutePath = this.getAbsoluteFilePathInternal(file.path);
    if (!existsSync(absolutePath)) {
      throw new NotFoundException('File not found on storage');
    }

    const stats = statSync(absolutePath);
    if (stats.isDirectory()) {
      throw new BadRequestException('Streaming directories is not supported');
    }

    const fileSize = stats.size;
    const range = req.headers.range;
    const contentType = file.mimetype || 'application/octet-stream';

    if (range) {
      const parts = (range as string).replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (isNaN(start) || isNaN(end) || start > end || start >= fileSize) {
        res.status(416).setHeader('Content-Range', `bytes */${fileSize}`);
        return res.end();
      }

      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Length', (end - start + 1).toString());
      res.setHeader('Content-Type', contentType);

      const stream = createReadStream(absolutePath, { start, end });
      stream.on('error', () => res.status(500).end());
      stream.pipe(res);
    } else {
      res.status(200);
      res.setHeader('Content-Length', fileSize.toString());
      res.setHeader('Content-Type', contentType);
      res.setHeader('Accept-Ranges', 'bytes');

      const stream = createReadStream(absolutePath);
      stream.on('error', () => res.status(500).end());
      stream.pipe(res);
    }
  }

  /**
   * Get absolute file path from stored path
   * Public method for use by UploadService
   */
  public getAbsoluteFilePath(filename: string): string {
    // Handle cases where `filename` is:
    // - an absolute path -> return as-is
    // - already contains the uploadDir as prefix (eg 'uploads/xxx' or 'uploads\\xxx') -> strip prefix
    // - a plain filename -> join with uploadDir
    if (!filename) {
      throw new Error('Filename is required');
    }

    const uploadRootPrefix = `/${this.uploadDir.replace(/\\/g, '/')}/`;
    const normalizedInput = filename.replace(/\\/g, '/');

    if (normalizedInput.startsWith(uploadRootPrefix)) {
      const relative = normalizedInput.substring(uploadRootPrefix.length);
      return join(process.cwd(), this.uploadDir, relative);
    }

    // If absolute filesystem path, return normalized
    if (isAbsolute(filename)) {
      return normalize(filename);
    }

    // If it's a URL (http/https), map URL pathname to local uploadDir
    if (/^https?:\/\//i.test(filename)) {
      try {
        const url = new URL(filename);
        let pathname = url.pathname.replace(/^\//, '');
        const uploadDirPrefix = this.uploadDir.replace(/\\/g, '/');
        // If pathname starts with uploadDir, strip it to avoid duplication
        if (pathname.startsWith(uploadDirPrefix + '/')) {
          pathname = pathname.substring(uploadDirPrefix.length + 1);
        }
        return join(process.cwd(), this.uploadDir, pathname);
      } catch (err) {
        throw new Error('Invalid URL stored for file path');
      }
    }

    // Normalize separators for relative paths
    let normalized = normalizedInput;

    const uploadDirPrefix = this.uploadDir.replace(/\\/g, '/');
    if (normalized.startsWith(uploadDirPrefix + '/')) {
      // remove leading uploadDir/
      normalized = normalized.substring(uploadDirPrefix.length + 1);
    }

    return join(process.cwd(), this.uploadDir, normalized);
  }

  /**
   * Get absolute file path from stored path (private helper)
   * @private
   */
  private getAbsoluteFilePathInternal(filename: string): string {
    if (!filename) {
      throw new Error('Filename is required');
    }

    const uploadRootPrefix = `/${this.uploadDir.replace(/\\/g, '/')}/`;
    const normalizedInput = filename.replace(/\\/g, '/');

    if (normalizedInput.startsWith(uploadRootPrefix)) {
      const relative = normalizedInput.substring(uploadRootPrefix.length);
      return join(process.cwd(), this.uploadDir, relative);
    }

    if (isAbsolute(filename)) {
      return normalize(filename);
    }
    if (/^https?:\/\//i.test(filename)) {
      try {
        const url = new URL(filename);
        let pathname = url.pathname.replace(/^\//, '');
        const uploadDirPrefix = this.uploadDir.replace(/\\/g, '/');
        if (pathname.startsWith(uploadDirPrefix + '/')) {
          pathname = pathname.substring(uploadDirPrefix.length + 1);
        }
        return join(process.cwd(), this.uploadDir, pathname);
      } catch (err) {
        throw new Error('Invalid URL stored for file path');
      }
    }
    let normalized = normalizedInput;
    const uploadDirPrefix = this.uploadDir.replace(/\\/g, '/');
    if (normalized.startsWith(uploadDirPrefix + '/')) {
      normalized = normalized.substring(uploadDirPrefix.length + 1);
    }
    return join(process.cwd(), this.uploadDir, normalized);
  }
}
