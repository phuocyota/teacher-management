import { BadRequestException, Injectable } from '@nestjs/common';
import { basename, extname, posix } from 'path';
import * as unzipper from 'unzipper';
import {
  InspectedExamZip,
  ZipArchiveEntry,
  ZipAudioEntry,
} from '../types/question-bank-zip-import.types';
import { normalizeImportSignature } from '../utils/question-import-text.utils';

const MAX_ZIP_SIZE = 500 * 1024 * 1024;
const MAX_ENTRIES = 200;
const MAX_TOTAL_SIZE = 1024 * 1024 * 1024;
const MAX_PDF_SIZE = 100 * 1024 * 1024;
const MAX_AUDIO_SIZE = 200 * 1024 * 1024;
const AUDIO_MIMES: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.aac': 'audio/aac',
  '.m4a': 'audio/mp4',
};

interface UnzipEntry {
  path: string;
  type: string;
  flags?: number;
  uncompressedSize?: number;
  externalFileAttributes?: number;
  buffer(): Promise<Buffer>;
}

const unzipApi = unzipper as unknown as {
  Open: {
    buffer(buffer: Buffer): Promise<{ files: UnzipEntry[] }>;
  };
};

@Injectable()
export class ExamZipReaderService {
  async inspect(zipBuffer: Buffer): Promise<InspectedExamZip> {
    if (!zipBuffer?.length) {
      throw new BadRequestException('File ZIP rỗng');
    }
    if (zipBuffer.length > MAX_ZIP_SIZE) {
      throw new BadRequestException('File ZIP vượt quá 500 MB');
    }

    let directory: { files: UnzipEntry[] };
    try {
      directory = await unzipApi.Open.buffer(zipBuffer);
    } catch {
      throw new BadRequestException('File ZIP không hợp lệ hoặc bị hỏng');
    }

    const archiveEntries = directory.files.filter(
      (entry) => !this.isIgnored(entry.path),
    );
    if (archiveEntries.length > MAX_ENTRIES) {
      throw new BadRequestException(`ZIP vượt quá ${MAX_ENTRIES} file`);
    }

    let totalSize = 0;
    for (const entry of archiveEntries) {
      this.assertSafeEntry(entry);
      totalSize += Number(entry.uncompressedSize ?? 0);
      if (totalSize > MAX_TOTAL_SIZE) {
        throw new BadRequestException('Tổng dung lượng giải nén vượt quá 1 GB');
      }
    }
    const fileEntries = archiveEntries.filter(
      (entry) => entry.type !== 'Directory',
    );

    const pdfEntries = fileEntries.filter(
      (entry) => extname(entry.path).toLowerCase() === '.pdf',
    );
    if (pdfEntries.length !== 1) {
      throw new BadRequestException('ZIP phải chứa đúng một file PDF');
    }

    const audioEntries = fileEntries.filter((entry) =>
      Object.hasOwn(AUDIO_MIMES, extname(entry.path).toLowerCase()),
    );
    const supportedPaths = new Set([
      pdfEntries[0].path,
      ...audioEntries.map((entry) => entry.path),
    ]);
    const warnings = fileEntries
      .filter((entry) => !supportedPaths.has(entry.path))
      .map((entry) => `Bỏ qua file không được hỗ trợ: ${entry.path}`);

    const pdf = await this.toArchiveEntry(pdfEntries[0], MAX_PDF_SIZE, 'PDF');
    if (!pdf.buffer.subarray(0, 5).equals(Buffer.from('%PDF-'))) {
      throw new BadRequestException('File .pdf không có chữ ký PDF hợp lệ');
    }
    const audioFiles: ZipAudioEntry[] = [];
    for (const entry of audioEntries) {
      const archiveEntry = await this.toArchiveEntry(
        entry,
        MAX_AUDIO_SIZE,
        'audio',
      );
      if (
        !this.hasValidAudioSignature(
          archiveEntry.extension,
          archiveEntry.buffer,
        )
      ) {
        throw new BadRequestException(
          `File audio không hợp lệ hoặc sai phần mở rộng: ${archiveEntry.path}`,
        );
      }
      audioFiles.push({
        ...archiveEntry,
        mimetype: AUDIO_MIMES[archiveEntry.extension],
        normalizedLabel: this.normalizeAudioLabel(archiveEntry.originalName),
      });
    }

    return { pdf, audioFiles, warnings };
  }

  normalizeAudioLabel(value: string): string {
    const withoutExtension = value.slice(
      0,
      value.length - extname(value).length,
    );
    return normalizeImportSignature(withoutExtension);
  }

  private async toArchiveEntry(
    entry: UnzipEntry,
    maxSize: number,
    label: string,
  ): Promise<ZipArchiveEntry> {
    const declaredSize = Number(entry.uncompressedSize ?? 0);
    if (declaredSize > maxSize) {
      throw new BadRequestException(
        `File ${label} vượt quá giới hạn dung lượng`,
      );
    }
    const buffer = await entry.buffer();
    if (
      buffer.length > maxSize ||
      (declaredSize && buffer.length !== declaredSize)
    ) {
      throw new BadRequestException(
        `Dung lượng file ${entry.path} không hợp lệ`,
      );
    }
    const originalName = basename(entry.path.replace(/\\/g, '/'));
    return {
      path: entry.path,
      originalName,
      extension: extname(originalName).toLowerCase(),
      size: buffer.length,
      buffer,
    };
  }

  private assertSafeEntry(entry: UnzipEntry): void {
    const normalizedPath = entry.path.replace(/\\/g, '/');
    if (
      !normalizedPath ||
      posix.isAbsolute(normalizedPath) ||
      /^[a-z]:/iu.test(normalizedPath) ||
      posix.normalize(normalizedPath).startsWith('../') ||
      normalizedPath.split('/').includes('..')
    ) {
      throw new BadRequestException(
        `Đường dẫn ZIP không an toàn: ${entry.path}`,
      );
    }
    if (normalizedPath.includes('/')) {
      throw new BadRequestException(
        `ZIP không được chứa thư mục con: ${entry.path}`,
      );
    }
    if ((Number(entry.flags ?? 0) & 0x1) !== 0) {
      throw new BadRequestException(
        `Không hỗ trợ file ZIP mã hóa: ${entry.path}`,
      );
    }
    const unixMode = Number(entry.externalFileAttributes ?? 0) >>> 16;
    if ((unixMode & 0o170000) === 0o120000) {
      throw new BadRequestException(
        `Không hỗ trợ symlink trong ZIP: ${entry.path}`,
      );
    }
  }

  private hasValidAudioSignature(extension: string, buffer: Buffer): boolean {
    if (extension === '.mp3') {
      return (
        buffer.subarray(0, 3).toString('ascii') === 'ID3' ||
        (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0)
      );
    }
    if (extension === '.wav') {
      return (
        buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
        buffer.subarray(8, 12).toString('ascii') === 'WAVE'
      );
    }
    if (extension === '.ogg') {
      return buffer.subarray(0, 4).toString('ascii') === 'OggS';
    }
    if (extension === '.aac') {
      return buffer[0] === 0xff && (buffer[1] & 0xf6) === 0xf0;
    }
    if (extension === '.m4a') {
      return buffer.subarray(4, 8).toString('ascii') === 'ftyp';
    }
    return false;
  }

  private isIgnored(pathValue: string): boolean {
    const normalized = pathValue.replace(/\\/g, '/');
    return (
      normalized.startsWith('__MACOSX/') ||
      normalized.split('/').some((part) => part === '.DS_Store')
    );
  }
}
