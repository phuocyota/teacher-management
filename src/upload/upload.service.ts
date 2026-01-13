import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import {
  existsSync,
  mkdirSync,
  unlinkSync,
  renameSync,
  createReadStream,
  statSync,
} from 'fs';
import {
  join,
  dirname,
  isAbsolute,
  normalize,
  basename,
  resolve,
  sep,
} from 'path';
import { FileEntity } from './entity/file.entity';
import { FileAccessEntity } from './entity/file-access.entity';
import { FileAccessType, FileType } from './enum/file-visibility.enum';
import {
  UploadFileResponseDto,
  UploadMultipleFilesResponseDto,
  FileAccessResponseDto,
  UploadFolderResponseDto,
  FolderPathResponseDto,
} from './dto/upload.dto';
import { JwtPayload } from 'src/common/interface/jwt-payload.interface';
import { UserType } from 'src/common/enum/user-type.enum';
import { ERROR_MESSAGES } from 'src/common/constant/error-messages.constant';
import {
  PaginationRequestDto,
  PaginationResponseDto,
} from 'src/common/dto/pagination.dto';
import type { Request, Response } from 'express';

// Interface cho Multer File
interface MulterFile {
  originalname: string;
  filename: string;
  path: string;
  mimetype: string;
  size: number;
}

@Injectable()
export class UploadService {
  private readonly uploadDir: string;
  private readonly publicBaseUrl?: string;

  constructor(
    @InjectRepository(FileEntity)
    private readonly fileRepo: Repository<FileEntity>,
    @InjectRepository(FileAccessEntity)
    private readonly fileAccessRepo: Repository<FileAccessEntity>,
    private readonly configService: ConfigService,
  ) {
    this.uploadDir = this.configService.get('UPLOAD_DIR') || 'uploads';
    this.publicBaseUrl = this.configService.get('PUBLIC_BASE_URL');
    this.ensureUploadDirExists();
  }

  /**
   * Đảm bảo thư mục upload tồn tại
   */
  private ensureUploadDirExists(): void {
    try {
      if (!existsSync(this.uploadDir)) {
        mkdirSync(this.uploadDir, { recursive: true });
      }
    } catch (error) {
      // Gracefully handle permission errors
      throw new Error(
        `Không thể tạo thư mục upload: ${this.uploadDir}. Vui lòng kiểm tra quyền truy cập., Error: ${error}`,
      );
    }
  }

  /**
   * Xử lý upload single file và lưu vào database
   */
  async handleFileUpload(
    file: MulterFile,
    user: JwtPayload,
    fileType: FileType = FileType.NORMAL,
    description?: string,
    preserveOriginalName = false,
  ): Promise<UploadFileResponseDto> {
    if (!file) {
      throw new BadRequestException('Không có file nào được upload');
    }

    const originalName = this.normalizeOriginalName(file.originalname);

    // By default, use the stored filename from multer
    let storedFilename = file.filename;
    let dbPath = file.path;

    if (preserveOriginalName) {
      const safeName = basename(originalName);

      // Destination relative path inside uploadDir
      const destRelative = safeName;
      const destDbPath = join(this.uploadDir, destRelative);
      const destFsPath = join(process.cwd(), this.uploadDir, destRelative);

      // Prevent overwrite on disk and in DB
      if (existsSync(destFsPath)) {
        throw new BadRequestException(`File ${safeName} đã tồn tại`);
      }

      const existsByFilename = await this.fileRepo.findOne({
        where: { filename: safeName },
      });
      if (existsByFilename) {
        throw new BadRequestException(`File ${safeName} đã tồn tại`);
      }

      // Ensure upload dir exists
      try {
        mkdirSync(dirname(destFsPath), { recursive: true });
      } catch (err) {
        throw new BadRequestException(err);
      }

      // Move/rename the temp file to the destination path
      try {
        const srcPath = isAbsolute(file.path)
          ? file.path
          : join(process.cwd(), file.path);
        if (srcPath !== destFsPath) {
          renameSync(srcPath, destFsPath);
        }
      } catch (err) {
        // If rename fails, rethrow as bad request to avoid silent inconsistencies
        throw new BadRequestException('Không thể lưu file với tên gốc');
      }

      storedFilename = safeName;
      dbPath = destDbPath;
    }

    // If a public base URL is configured, expose the public URL as the stored path
    const storedPath = this.publicBaseUrl
      ? `${this.publicBaseUrl.replace(/\/$/, '')}/${storedFilename}`
      : dbPath;

    const saved = await this.fileRepo.save(
      this.fileRepo.create({
        originalName,
        filename: storedFilename,
        path: storedPath,
        mimetype: file.mimetype,
        size: file.size,
        fileType,
        description,
        createdBy: user.userId,
        uploadedBy: user.userId,
      }),
    );

    return UploadFileResponseDto.fromEntity(saved);
  }

  /**
   * Xử lý upload nhiều file
   */
  async handleMultipleFilesUpload(
    files: MulterFile[],
    user: JwtPayload,
    fileType: FileType = FileType.NORMAL,
  ): Promise<UploadMultipleFilesResponseDto> {
    if (!files || files.length === 0) {
      throw new BadRequestException('Không có file nào được upload');
    }

    const savedFiles: UploadFileResponseDto[] = [];

    for (const file of files) {
      const fileDto = await this.handleFileUpload(file, user, fileType);
      savedFiles.push(fileDto);
    }

    return {
      files: savedFiles,
      totalFiles: savedFiles.length,
    };
  }

  /**
   * Xử lý upload một thư mục (nhiều file), giữ nguyên cấu trúc thư mục nếu client gửi kèm đường dẫn
   */
  async handleFolderUpload(
    files: MulterFile[],
    user: JwtPayload,
    fileType: FileType = FileType.NORMAL,
  ): Promise<UploadFolderResponseDto> {
    if (!files || files.length === 0) {
      throw new BadRequestException('Không có file nào được upload');
    }

    const savedFiles: UploadFileResponseDto[] = [];

    for (const file of files) {
      // file.originalname có thể chứa đường dẫn tương đối do client (ví dụ webkitRelativePath)
      // Lưu giữ cấu trúc bằng cách ghép với uploadDir
      const relativePath = file.originalname || file.filename;
      const destPath = join(this.uploadDir, relativePath);

      // Tạo thư mục đích nếu chưa tồn tại
      try {
        mkdirSync(dirname(destPath), { recursive: true });
      } catch (err) {
        throw new BadRequestException(err);
      }

      // If destination already exists on disk or in DB, reject to avoid overwrite
      if (existsSync(destPath)) {
        throw new BadRequestException(`File ${relativePath} đã tồn tại`);
      }
      const dbPath = join(this.uploadDir, relativePath);
      const existing = await this.fileRepo.findOne({ where: { path: dbPath } });
      if (existing) {
        throw new BadRequestException(`File ${relativePath} đã tồn tại`);
      }

      // Also check stored filename duplicate first
      const storedFilename = relativePath.split(/[\\/]/).pop();
      if (storedFilename) {
        const existsByFilename = await this.fileRepo.findOne({
          where: { filename: storedFilename },
        });
        if (existsByFilename) {
          throw new BadRequestException(
            `Tên file ${storedFilename} đã tồn tại`,
          );
        }
      }

      // Di chuyển file tạm của multer tới vị trí đích nếu cần
      try {
        if (file.path && file.path !== destPath) {
          renameSync(file.path, destPath);
        }
      } catch (err) {
        // Nếu không thể rename, ignore và tiếp tục — multer có thể đã lưu đúng chỗ
      }

      // Tạo entity và lưu vào DB
      const originalName = this.normalizeOriginalName(file.originalname);
      const localPath = join(this.uploadDir, relativePath);
      const publicPath = this.publicBaseUrl
        ? `${this.publicBaseUrl.replace(/\/$/, '')}/${relativePath.replace(/\\/g, '/')}`
        : localPath;

      const fileEntity = this.fileRepo.create({
        originalName,
        filename: storedFilename,
        path: publicPath,
        mimetype: file.mimetype,
        size: file.size,
        fileType,
        uploadedBy: user.userId,
        createdBy: user.userId,
      });

      const saved = await this.fileRepo.save(fileEntity);
      savedFiles.push(UploadFileResponseDto.fromEntity(saved));
    }

    // Tìm thư mục gốc chung (nếu có)
    const paths = files.map((f) => f.originalname || f.filename);
    const splitPaths = paths.map((p) => p.split(/[\\/]+/).filter(Boolean));
    let commonParts: string[] = [];
    if (splitPaths.length > 0) {
      for (let i = 0; ; i++) {
        const part = splitPaths[0][i];
        if (!part) break;
        if (splitPaths.every((sp) => sp[i] === part)) {
          commonParts.push(part);
        } else break;
      }
    }
    const folderPath = commonParts.join('/');

    return UploadFolderResponseDto.from(savedFiles, folderPath);
  }

  /**
   * Lấy thông tin file theo ID
   */
  async getFileById(fileId: string): Promise<FileEntity> {
    const file = await this.fileRepo.findOne({ where: { id: fileId } });
    if (!file) {
      throw new NotFoundException(
        ERROR_MESSAGES.NOT_FOUND_WITH_ID('File', fileId),
      );
    }
    return file;
  }

  /**
   * Lấy thông tin file theo filename
   */
  async getFileByFilename(filename: string): Promise<FileEntity> {
    const file = await this.fileRepo.findOne({ where: { filename } });
    if (!file) {
      throw new NotFoundException(ERROR_MESSAGES.NOT_FOUND('File'));
    }
    return file;
  }

  async download(fileId: string, res: Response) {
    // 1️⃣ Lấy metadata file
    const file = await this.fileRepo.findOne({ where: { id: fileId } });

    if (!file) throw new NotFoundException('File not found');

    // 2️⃣ Build local absolute path and validate
    const absolutePath = this.getAbsoluteFilePath(file.path);
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
    const file = await this.getFileByFilename(filename);

    const absolutePath = this.getAbsoluteFilePath(file.path);
    if (!existsSync(absolutePath)) {
      throw new NotFoundException('File not found on storage');
    }

    const stats = statSync(absolutePath);
    if (stats.isDirectory()) {
      throw new BadRequestException('Cannot serve a directory');
    }

    // Validate that file is an image
    // if (!file.mimetype || !file.mimetype.startsWith('image/')) {
    //   throw new BadRequestException('File is not an image');
    // }

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

    const absolutePath = this.getAbsoluteFilePath(file.path);
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
   * Cấp quyền truy cập file cho user
   */
  async grantFileAccess(
    fileId: string,
    userId: string,
    accessType: FileAccessType,
    grantedBy: JwtPayload,
    expiresAt?: Date,
  ): Promise<FileAccessResponseDto> {
    const file = await this.getFileById(fileId);

    // Chỉ owner hoặc admin mới có thể cấp quyền
    if (
      file.uploadedBy !== grantedBy.userId &&
      grantedBy.userType !== UserType.ADMIN
    ) {
      throw new ForbiddenException(
        'Bạn không có quyền cấp quyền truy cập file này',
      );
    }

    // Kiểm tra xem đã có quyền chưa
    let access = await this.fileAccessRepo.findOne({
      where: { fileId, userId },
    });

    if (access) {
      // Cập nhật quyền
      access.accessType = accessType;
      access.expiresAt = expiresAt;
      access.updatedBy = grantedBy.userId;
    } else {
      // Tạo mới
      access = this.fileAccessRepo.create({
        fileId,
        userId,
        accessType,
        grantedBy: grantedBy.userId,
        expiresAt,
        createdBy: grantedBy.userId,
      });
    }

    const saved = await this.fileAccessRepo.save(access);
    return FileAccessResponseDto.fromEntity(saved);
  }

  /**
   * Cấp quyền cho nhiều users
   */
  async grantFileAccessToMany(
    fileId: string,
    userIds: string[],
    accessType: FileAccessType,
    grantedBy: JwtPayload,
    expiresAt?: Date,
  ): Promise<FileAccessResponseDto[]> {
    const results: FileAccessResponseDto[] = [];

    for (const userId of userIds) {
      const access = await this.grantFileAccess(
        fileId,
        userId,
        accessType,
        grantedBy,
        expiresAt,
      );
      results.push(access);
    }

    return results;
  }

  /**
   * Lấy danh sách quyền truy cập của file
   */
  async getFileAccessList(
    fileId: string,
    user: JwtPayload,
  ): Promise<FileAccessResponseDto[]> {
    const file = await this.getFileById(fileId);

    // Chỉ owner hoặc admin mới xem được danh sách quyền
    if (file.uploadedBy !== user.userId && user.userType !== UserType.ADMIN) {
      throw new ForbiddenException(
        'Bạn không có quyền xem danh sách quyền truy cập file này',
      );
    }

    const accessList = await this.fileAccessRepo.find({
      where: { fileId },
      relations: ['file'],
    });

    return accessList.map((access) => FileAccessResponseDto.fromEntity(access));
  }

  /**
   * Lấy danh sách file user có quyền truy cập
   */
  async getAccessibleFiles(user: JwtPayload): Promise<UploadFileResponseDto[]> {
    // Lấy file user upload
    const myFiles = await this.fileRepo.find({
      where: { uploadedBy: user.userId },
    });

    // Lấy file được cấp quyền
    const accessList = await this.fileAccessRepo.find({
      where: { userId: user.userId },
    });

    const accessibleFileIds = accessList
      .filter((a) => !a.expiresAt || new Date(a.expiresAt) >= new Date())
      .map((a) => a.fileId);

    let restrictedFiles: FileEntity[] = [];
    if (accessibleFileIds.length > 0) {
      restrictedFiles = await this.fileRepo.find({
        where: { id: In(accessibleFileIds) },
      });
    }

    // Gộp và loại bỏ trùng lặp
    const allFiles = [...myFiles, ...restrictedFiles];
    const uniqueFiles = allFiles.filter(
      (file, index, self) => index === self.findIndex((f) => f.id === file.id),
    );

    const sorted = uniqueFiles.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    return sorted.map((file) => UploadFileResponseDto.fromEntity(file));
  }

  async listFiles(
    user: JwtPayload,
    dto: PaginationRequestDto,
  ): Promise<PaginationResponseDto<UploadFileResponseDto>> {
    const page = dto.page ?? 1;
    const size = dto.size ?? 10;
    const keyword = dto.search?.trim().toLowerCase();

    const sourceFiles =
      user.userType === UserType.ADMIN
        ? await this.getAllFiles()
        : await this.getAccessibleFiles(user);

    const filtered = keyword
      ? sourceFiles.filter((file) => this.matchesSearchTerm(file, keyword))
      : sourceFiles;

    const startIndex = (page - 1) * size;
    const paged = filtered.slice(startIndex, startIndex + size);

    return {
      page,
      size,
      total: filtered.length,
      data: paged,
    };
  }

  private matchesSearchTerm(
    file: UploadFileResponseDto,
    keyword: string,
  ): boolean {
    const haystack = `${file.originalName ?? ''} ${file.filename ?? ''} ${
      file.description ?? ''
    }`.toLowerCase();
    return haystack.includes(keyword);
  }

  /**
   * Lấy tất cả file (dành cho admin)
   */
  async getAllFiles(): Promise<UploadFileResponseDto[]> {
    const files = await this.fileRepo.find();
    const sorted = files.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    return sorted.map((file) => UploadFileResponseDto.fromEntity(file));
  }

  /**
   * Xóa file (có kiểm tra quyền)
   */
  public async deleteFile(
    filename: string,
    user: JwtPayload,
  ): Promise<boolean> {
    const file = await this.getFileByFilename(filename);

    // Chỉ owner hoặc admin mới có thể xóa
    if (file.uploadedBy !== user.userId && user.userType !== UserType.ADMIN) {
      throw new ForbiddenException('Bạn không có quyền xóa file này');
    }

    // Xóa file vật lý
    const absolutePath = this.getAbsoluteFilePath(file.path);
    if (existsSync(absolutePath)) {
      unlinkSync(absolutePath);
    }

    // Xóa trong database (cascade sẽ xóa cả file_access)
    await this.fileRepo.delete({ id: file.id });

    return true;
  }

  /**
   * Lấy đường dẫn đầy đủ của file
   */
  private getAbsoluteFilePath(filename: string): string {
    // Handle cases where `filename` is:
    // - an absolute path -> return as-is
    // - already contains the uploadDir as prefix (eg 'uploads/xxx' or 'uploads\\xxx') -> strip prefix
    // - a plain filename -> join with uploadDir
    if (!filename) {
      throw new Error('Filename is required');
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
        const uploadPrefix = this.uploadDir.replace(/\\/g, '/');
        // If pathname starts with uploadDir, strip it to avoid duplication
        if (pathname.startsWith(uploadPrefix + '/')) {
          pathname = pathname.substring(uploadPrefix.length + 1);
        }
        return join(process.cwd(), this.uploadDir, pathname);
      } catch (err) {
        throw new Error('Invalid URL stored for file path');
      }
    }

    // Normalize separators for relative paths
    let normalized = filename.replace(/\\/g, '/');

    const uploadPrefix = this.uploadDir.replace(/\\/g, '/');
    if (normalized.startsWith(uploadPrefix + '/')) {
      // remove leading uploadDir/
      normalized = normalized.substring(uploadPrefix.length + 1);
    }

    return join(process.cwd(), this.uploadDir, normalized);
  }

  /**
   * Normalize original filename to UTF-8 when common garbling (latin1 interpretation) occurs.
   */
  private normalizeOriginalName(name?: string): string {
    if (!name) return 'unknown';
    // If name contains common mojibake markers (Ã, Â, Ä), attempt latin1->utf8 conversion
    if (/[ÃÂÄ]/.test(name)) {
      try {
        const converted = Buffer.from(name, 'latin1').toString('utf8');
        return converted;
      } catch (err) {
        return name;
      }
    }

    return name;
  }

  async ensureFolderPath(relativePath: string): Promise<FolderPathResponseDto> {
    const sanitizedPath = this.sanitizeFolderPath(relativePath);
    const uploadBasePath = resolve(process.cwd(), this.uploadDir);
    const targetPath = resolve(uploadBasePath, sanitizedPath);

    if (!this.isPathInsideUploadDir(targetPath, uploadBasePath)) {
      throw new BadRequestException('Đường dẫn thư mục không hợp lệ');
    }

    let created = false;
    if (existsSync(targetPath)) {
      const stats = statSync(targetPath);
      if (!stats.isDirectory()) {
        throw new BadRequestException('Một file cùng tên đã tồn tại');
      }
    } else {
      try {
        mkdirSync(targetPath, { recursive: true });
        created = true;
      } catch (err) {
        throw new BadRequestException(
          `Không thể tạo thư mục: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    const response = new FolderPathResponseDto();
    response.relativePath = sanitizedPath;
    response.absolutePath = targetPath;
    response.created = created;
    return response;
  }

  private sanitizeFolderPath(pathValue: string): string {
    const trimmed = pathValue?.trim();
    if (!trimmed) {
      throw new BadRequestException('Đường dẫn thư mục không được để trống');
    }

    if (trimmed.includes('..')) {
      throw new BadRequestException(
        'Đường dẫn không được phép chứa phần tử cha (..)',
      );
    }

    const normalized = trimmed
      .replace(/\\/g, '/')
      .replace(/\/+/g, '/')
      .replace(/^\/+/, '');

    if (!normalized) {
      throw new BadRequestException('Đường dẫn thư mục không được để trống');
    }

    return normalized;
  }

  private isPathInsideUploadDir(targetPath: string, basePath: string): boolean {
    const separatorAppended = basePath.endsWith(sep)
      ? basePath
      : `${basePath}${sep}`;
    return targetPath === basePath || targetPath.startsWith(separatorAppended);
  }

  getFilePath(filename: string): string {
    return join(process.cwd(), this.uploadDir, filename);
  }

  public downloadFile(filename: string): { filePath: string } {
    const filePath = this.getFilePath(filename);
    return { filePath };
  }
}
