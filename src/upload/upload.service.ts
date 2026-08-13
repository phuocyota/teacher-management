import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository, In } from 'typeorm';
import {
  existsSync,
  mkdirSync,
  renameSync,
  statSync,
  writeFileSync,
  appendFileSync,
  readFileSync,
  readdirSync,
  rmSync,
  createReadStream,
  createWriteStream,
} from 'fs';
import { join, dirname, isAbsolute, basename, resolve, sep } from 'path';
import { createUnzip } from 'zlib';
import * as unzipper from 'unzipper';
import { FileEntity } from './entity/file.entity';
import { FileAccessEntity } from './entity/file-access.entity';
import { FileAccessType, FileType } from './enum/file-visibility.enum';
import { StreamService } from './services/stream.service';
import {
  UploadFileResponseDto,
  UploadMultipleFilesResponseDto,
  FileAccessResponseDto,
  UploadFolderResponseDto,
  FolderPathResponseDto,
  InitUploadDto,
  InitUploadResponseDto,
  CompleteUploadDto,
  CompleteUploadResponseDto,
  UpdateVersionDto,
  UpdateVersionResponseDto,
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
  private readonly chunksDir: string;
  private uploadSessions: Map<
    string,
    {
      fileName: string;
      fileSize: number;
      totalChunks: number;
      receivedChunks: Set<number>;
      mimeType?: string;
      fileType?: FileType;
      userId: string;
    }
  > = new Map();

  constructor(
    @InjectRepository(FileEntity)
    private readonly fileRepo: Repository<FileEntity>,
    @InjectRepository(FileAccessEntity)
    private readonly fileAccessRepo: Repository<FileAccessEntity>,
    private readonly configService: ConfigService,
    private readonly streamService: StreamService,
  ) {
    this.uploadDir = this.configService.get('UPLOAD_DIR') || 'uploads';
    this.chunksDir = join(this.uploadDir, 'chunks');
    this.publicBaseUrl = this.configService.get('PUBLIC_BASE_URL');
    this.ensureUploadDirExists();
    this.ensureChunksDirExists();
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
   * Đảm bảo thư mục chunks tồn tại
   */
  private ensureChunksDirExists(): void {
    try {
      if (!existsSync(this.chunksDir)) {
        mkdirSync(this.chunksDir, { recursive: true });
      }
    } catch (error) {
      throw new Error(
        `Không thể tạo thư mục chunks: ${this.chunksDir}. Error: ${error}`,
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
   * Save an in-memory buffer as a file on disk and persist file metadata.
   * Useful for generated assets such as extracted PDF images.
   */
  async saveBufferAsFile(
    buffer: Buffer,
    options: {
      originalName: string;
      mimetype: string;
      uploadedBy: string;
      fileType?: FileType;
      description?: string;
      folderPath?: string;
      storedPathPrefix?: string;
      manager?: EntityManager;
    },
  ): Promise<UploadFileResponseDto> {
    if (!buffer || buffer.length === 0) {
      throw new BadRequestException('Buffer is empty');
    }

    const originalName = this.normalizeOriginalName(options.originalName);
    const safeBaseName = basename(originalName);
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const storedFilename = `${uniqueSuffix}-${safeBaseName}`;
    const relativePath = options.folderPath
      ? join(options.folderPath, storedFilename)
      : storedFilename;
    const diskPath = join(process.cwd(), this.uploadDir, relativePath);

    mkdirSync(dirname(diskPath), { recursive: true });
    writeFileSync(diskPath, buffer);

    const normalizedRelativePath = relativePath.replace(/\\/g, '/');
    const prefix =
      options.storedPathPrefix ??
      (this.publicBaseUrl ? this.publicBaseUrl.replace(/\/$/, '') : '');
    const storedPath = prefix
      ? `${prefix}/${normalizedRelativePath}`
      : `${this.uploadDir.replace(/\\/g, '/')}/${normalizedRelativePath}`;

    const fileRepo =
      options.manager?.getRepository(FileEntity) ?? this.fileRepo;
    let saved: FileEntity;
    try {
      saved = await fileRepo.save(
        fileRepo.create({
          originalName,
          filename: storedFilename,
          path: storedPath,
          mimetype: options.mimetype,
          size: buffer.length,
          fileType: options.fileType ?? FileType.NORMAL,
          description: options.description,
          createdBy: options.uploadedBy,
          uploadedBy: options.uploadedBy,
        }),
      );
    } catch (error) {
      if (existsSync(diskPath)) {
        rmSync(diskPath);
      }
      throw error;
    }

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
    return this.streamService.download(fileId, res);
  }

  /**
   * Serve image file with appropriate content-type
   */
  async serveImage(filename: string, res: Response) {
    return this.streamService.serveImage(filename, res);
  }

  /**
   * Stream file with support for Range requests (partial content)
   */
  async stream(fileId: string, req: Request, res: Response) {
    return this.streamService.stream(fileId, req, res);
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
    const absolutePath = this.streamService.getAbsoluteFilePath(file.path);
    if (existsSync(absolutePath)) {
      rmSync(absolutePath);
    }

    // Xóa trong database (cascade sẽ xóa cả file_access)
    await this.fileRepo.delete({ id: file.id });

    return true;
  }

  /**
   * Delete file on disk by stored path or URL without DB lookup.
   * Best-effort: returns false on any failure.
   */
  public async deleteFileByPath(pathValue: string): Promise<boolean> {
    if (!pathValue) {
      return false;
    }

    let absolutePath: string | undefined;
    try {
      absolutePath = this.streamService.getAbsoluteFilePath(pathValue);
    } catch (error) {
      absolutePath = undefined;
    }

    let deletedPhysicalFile = false;

    if (absolutePath && existsSync(absolutePath)) {
      try {
        const stats = statSync(absolutePath);
        if (stats.isFile()) {
          rmSync(absolutePath);
          deletedPhysicalFile = true;
        }
      } catch (error) {
        deletedPhysicalFile = false;
      }
    }

    const deletedFileRecord = await this.deleteFileRecordByPath(
      pathValue,
      absolutePath,
    );

    return deletedPhysicalFile || deletedFileRecord;
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

  private async deleteFileRecordByPath(
    pathValue: string,
    absolutePath?: string,
  ): Promise<boolean> {
    const candidatePaths = new Set<string>();
    const candidateFilenames = new Set<string>();
    const isUrlPath = /^https?:\/\//i.test(pathValue);
    const normalizedPathValue = pathValue.replace(/\\/g, '/');
    const sanitizedPathValue = normalizedPathValue.split(/[?#]/)[0];
    const uploadPrefix = this.uploadDir.replace(/\\/g, '/');
    const normalizedPublicBaseUrl = this.publicBaseUrl?.replace(/\/$/, '');
    const canDeriveFromAbsolute =
      !isUrlPath ||
      (!!normalizedPublicBaseUrl &&
        normalizedPathValue.startsWith(normalizedPublicBaseUrl));

    candidatePaths.add(pathValue);
    candidatePaths.add(normalizedPathValue);

    if (sanitizedPathValue) {
      candidatePaths.add(sanitizedPathValue);
      if (sanitizedPathValue.startsWith('/')) {
        candidatePaths.add(sanitizedPathValue.slice(1));
      }

      if (sanitizedPathValue.startsWith('/uploads/')) {
        candidatePaths.add(sanitizedPathValue.slice('/uploads/'.length));
        candidatePaths.add(
          `${uploadPrefix}/${sanitizedPathValue.slice('/uploads/'.length)}`,
        );
      } else if (sanitizedPathValue.startsWith('uploads/')) {
        candidatePaths.add(sanitizedPathValue.slice('uploads/'.length));
        candidatePaths.add(
          `${uploadPrefix}/${sanitizedPathValue.slice('uploads/'.length)}`,
        );
      }

      if (!isUrlPath) {
        const inputFilename = basename(sanitizedPathValue);
        if (inputFilename && inputFilename !== '.') {
          candidateFilenames.add(inputFilename);
        }
      }
    }

    if (absolutePath && canDeriveFromAbsolute) {
      const absoluteFilename = basename(absolutePath);
      if (absoluteFilename) {
        candidateFilenames.add(absoluteFilename);
      }

      const absoluteUploadDir = resolve(process.cwd(), this.uploadDir);
      const resolvedTargetPath = resolve(absolutePath);
      if (
        resolvedTargetPath.startsWith(`${absoluteUploadDir}${sep}`) ||
        resolvedTargetPath === absoluteUploadDir
      ) {
        const relativePath = resolvedTargetPath
          .slice(absoluteUploadDir.length)
          .replace(/^[/\\]+/, '')
          .replace(/\\/g, '/');

        if (relativePath) {
          candidatePaths.add(relativePath);
          candidatePaths.add(`${uploadPrefix}/${relativePath}`);

          if (normalizedPublicBaseUrl) {
            candidatePaths.add(`${normalizedPublicBaseUrl}/${relativePath}`);
          }
        }
      }
    }

    const query = this.fileRepo.createQueryBuilder('file');
    const candidatePathList = [...candidatePaths].filter(Boolean);
    const candidateFilenameList = [...candidateFilenames].filter(Boolean);

    if (candidatePathList.length > 0) {
      query.where('file.path IN (:...paths)', { paths: candidatePathList });
    }

    if (candidateFilenameList.length > 0) {
      if (candidatePathList.length > 0) {
        query.orWhere('file.filename IN (:...filenames)', {
          filenames: candidateFilenameList,
        });
      } else {
        query.where('file.filename IN (:...filenames)', {
          filenames: candidateFilenameList,
        });
      }
    }

    if (candidatePathList.length === 0 && candidateFilenameList.length === 0) {
      return false;
    }

    const matchedFiles = await query.getMany();
    if (matchedFiles.length === 0) {
      return false;
    }

    await this.fileRepo.delete(matchedFiles.map((file) => file.id));
    return true;
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

  async updateVersionFile(
    dto: UpdateVersionDto,
  ): Promise<UpdateVersionResponseDto> {
    const relativePath = 'ichiteacher/version.json';
    const uploadBasePath = resolve(process.cwd(), this.uploadDir);
    const targetPath = resolve(uploadBasePath, relativePath);

    if (!this.isPathInsideUploadDir(targetPath, uploadBasePath)) {
      throw new BadRequestException('Đường dẫn file không hợp lệ');
    }

    try {
      mkdirSync(dirname(targetPath), { recursive: true });
    } catch (err) {
      throw new BadRequestException(
        `Không thể tạo thư mục: ${err instanceof Error ? err.message : err}`,
      );
    }

    const payload = {
      latestVersion: dto.latestVersion,
      forceUpdate: dto.forceUpdate,
      downloadUrl: dto.downloadUrl,
    };

    try {
      writeFileSync(targetPath, JSON.stringify(payload, null, 2), 'utf8');
    } catch (err) {
      throw new BadRequestException(
        `Không thể ghi file version: ${err instanceof Error ? err.message : err}`,
      );
    }

    return {
      ...payload,
      relativePath,
    };
  }

  async getVersionFile(): Promise<UpdateVersionResponseDto> {
    const relativePath = 'ichiteacher/version.json';
    const uploadBasePath = resolve(process.cwd(), this.uploadDir);
    const targetPath = resolve(uploadBasePath, relativePath);

    if (!this.isPathInsideUploadDir(targetPath, uploadBasePath)) {
      throw new BadRequestException('Đường dẫn file không hợp lệ');
    }

    if (!existsSync(targetPath)) {
      throw new NotFoundException('File version không tồn tại');
    }

    let parsed: unknown;
    try {
      const raw = readFileSync(targetPath, 'utf8');
      parsed = JSON.parse(raw);
    } catch (err) {
      throw new BadRequestException('File version không hợp lệ');
    }

    const payload = parsed as UpdateVersionDto;

    return {
      latestVersion: payload.latestVersion,
      forceUpdate: payload.forceUpdate,
      downloadUrl: payload.downloadUrl,
      relativePath,
    };
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

  /**
   * Khởi tạo chunked upload session
   */
  async initChunkedUpload(
    dto: InitUploadDto,
    user: JwtPayload,
  ): Promise<InitUploadResponseDto> {
    const uploadId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const sessionDir = join(this.chunksDir, uploadId);

    // Tạo thư mục cho session
    mkdirSync(sessionDir, { recursive: true });

    // Lưu thông tin session
    this.uploadSessions.set(uploadId, {
      fileName: dto.fileName,
      fileSize: dto.fileSize,
      totalChunks: dto.totalChunks,
      receivedChunks: new Set(),
      mimeType: dto.mimeType,
      fileType: dto.fileType || FileType.NORMAL,
      userId: user.userId,
    });

    return {
      uploadId,
      fileName: dto.fileName,
      totalChunks: dto.totalChunks,
    };
  }

  /**
   * Nhận và lưu chunk
   */
  async handleChunk(
    uploadId: string,
    chunkIndex: number,
    chunk: Buffer,
  ): Promise<{ received: number; total: number }> {
    const session = this.uploadSessions.get(uploadId);

    if (!session) {
      throw new NotFoundException(
        'Upload session không tồn tại hoặc đã hết hạn',
      );
    }

    const sessionDir = join(this.chunksDir, uploadId);
    const chunkPath = join(sessionDir, `chunk-${chunkIndex}`);

    // Lưu chunk
    writeFileSync(chunkPath, chunk);
    session.receivedChunks.add(chunkIndex);

    return {
      received: session.receivedChunks.size,
      total: session.totalChunks,
    };
  }

  /**
   * Hoàn thành upload và merge các chunks
   */
  async completeChunkedUpload(
    dto: CompleteUploadDto,
    user: JwtPayload,
  ): Promise<CompleteUploadResponseDto> {
    const session = this.uploadSessions.get(dto.uploadId);

    if (!session) {
      throw new NotFoundException('Upload session không tồn tại');
    }

    if (session.userId !== user.userId) {
      throw new ForbiddenException('Bạn không có quyền hoàn thành upload này');
    }

    if (session.receivedChunks.size !== session.totalChunks) {
      throw new BadRequestException(
        `Chưa nhận đủ chunks. Đã nhận: ${session.receivedChunks.size}/${session.totalChunks}`,
      );
    }

    const sessionDir = join(this.chunksDir, dto.uploadId);
    const timestamp = Date.now();
    const finalFileName = `${timestamp}-${session.fileName}`;
    const finalPath = join(this.uploadDir, finalFileName);

    // Merge các chunks theo thứ tự
    for (let i = 0; i < session.totalChunks; i++) {
      const chunkPath = join(sessionDir, `chunk-${i}`);
      const chunkData = readFileSync(chunkPath);
      appendFileSync(finalPath, chunkData);
    }

    // Lấy kích thước file sau khi merge
    const stats = statSync(finalPath);

    // Lưu vào database
    const fileEntity = this.fileRepo.create({
      originalName: session.fileName,
      filename: finalFileName,
      path: finalPath,
      mimetype: session.mimeType || 'application/octet-stream',
      size: stats.size,
      fileType: session.fileType,
      uploadedBy: user.userId,
      createdBy: user.userId,
    });

    const savedFile = await this.fileRepo.save(fileEntity);

    // Dọn dẹp session và chunks
    this.cleanupSession(dto.uploadId);

    const response: CompleteUploadResponseDto = {
      ...UploadFileResponseDto.fromEntity(savedFile),
      success: true,
    };

    // Xử lý unzip nếu được yêu cầu
    if (dto.unzip && session.fileName.toLowerCase().endsWith('.zip')) {
      try {
        const unzipResult = await this.unzipFile(
          finalPath,
          user.userId,
          dto.returnInformationLecture || false,
        );

        response.unzippedDir = unzipResult.unzippedDir;
        response.unzippedFiles = unzipResult.files;

        if (dto.returnInformationLecture) {
          response.pdfFile = unzipResult.pdfFile;
          response.htmlFile = unzipResult.htmlFile;
          response.mp4File = unzipResult.mp4File;
        }
      } catch (error) {
        // Không throw error, vẫn trả về file zip đã upload
        // Có thể thêm field error message vào response nếu cần
      }
    }

    return response;
  }

  /**
   * Giải nén file zip
   */
  private async unzipFile(
    zipFilePath: string,
    userId: string,
    returnInformationLecture: boolean = false,
  ): Promise<{
    unzippedDir: string;
    files: string[];
    pdfFile?: string;
    htmlFile?: string;
    mp4File?: string;
  }> {
    const zipFileName = basename(zipFilePath, '.zip');
    const unzippedDirName = `${zipFileName}-unzipped`;
    const unzippedDirPath = join(this.uploadDir, unzippedDirName);

    // Tạo thư mục để giải nén
    if (!existsSync(unzippedDirPath)) {
      mkdirSync(unzippedDirPath, { recursive: true });
    }

    const extractedFiles: string[] = [];

    // Giải nén file
    await new Promise<void>((resolve, reject) => {
      createReadStream(zipFilePath)
        .pipe(unzipper.Extract({ path: unzippedDirPath }))
        .on('close', () => resolve())
        .on('error', (err) => reject(err));
    });

    // Lấy danh sách file đã giải nén
    const getFilesRecursive = (
      dir: string,
      baseDir: string = dir,
    ): string[] => {
      const files: string[] = [];
      const items = readdirSync(dir, { withFileTypes: true });

      for (const item of items) {
        const fullPath = join(dir, item.name);
        const relativePath = fullPath.substring(baseDir.length + 1);

        if (item.isDirectory()) {
          files.push(...getFilesRecursive(fullPath, baseDir));
        } else {
          files.push(relativePath);
        }
      }

      return files;
    };

    extractedFiles.push(...getFilesRecursive(unzippedDirPath));

    // Tìm các file trong root level nếu được yêu cầu
    let pdfFile: string | undefined;
    let htmlFile: string | undefined;
    let mp4File: string | undefined;

    if (returnInformationLecture) {
      console.log(
        '[unzipFile] Searching for lecture files in root directory...',
      );
      const rootItems = readdirSync(unzippedDirPath, { withFileTypes: true });

      for (const item of rootItems) {
        if (item.isFile()) {
          const fileName = item.name.toLowerCase();
          const fullPath = join(unzippedDirPath, item.name);

          if (fileName.endsWith('.pdf') && !pdfFile) {
            pdfFile = fullPath;
            console.log(`[unzipFile] Found PDF: ${item.name}`);
          } else if (fileName.endsWith('.html') && !htmlFile) {
            htmlFile = fullPath;
            console.log(`[unzipFile] Found HTML: ${item.name}`);
          } else if (fileName.endsWith('.mp4') && !mp4File) {
            mp4File = fullPath;
            console.log(`[unzipFile] Found MP4: ${item.name}`);
          }
        }
      }

      console.log('[unzipFile] Lecture files found:', {
        pdf: !!pdfFile,
        html: !!htmlFile,
        mp4: !!mp4File,
      });
    }

    // Xóa file zip gốc
    try {
      rmSync(zipFilePath);
      console.log(`[unzipFile] Deleted original zip file: ${zipFilePath}`);

      // Xóa record trong database
      await this.fileRepo.delete({ path: zipFilePath });
      console.log(`[unzipFile] Deleted file record from database`);
    } catch (error) {
      console.error('[unzipFile] Failed to delete zip file:', error);
    }

    return {
      unzippedDir: unzippedDirPath,
      files: extractedFiles,
      pdfFile,
      htmlFile,
      mp4File,
    };
  }

  /**
   * Dọn dẹp upload session và xóa chunks
   */
  private cleanupSession(uploadId: string): void {
    const sessionDir = join(this.chunksDir, uploadId);

    try {
      // Xóa tất cả chunks
      if (existsSync(sessionDir)) {
        const files = readdirSync(sessionDir);

        files.forEach((file) => {
          const filePath = join(sessionDir, file);
          rmSync(filePath);
        });

        // Xóa thư mục session (dùng rmSync cho directory)
        rmSync(sessionDir, { recursive: true, force: true });
      } else {
      }

      // Xóa session khỏi memory
      this.uploadSessions.delete(uploadId);
    } catch (error) {}
  }
}
