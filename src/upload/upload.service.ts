import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { FileEntity } from './entity/file.entity';
import { FileAccessEntity } from './entity/file-access.entity';
import { FileAccessType, FileType } from './enum/file-visibility.enum';
import {
  UploadFileResponseDto,
  UploadMultipleFilesResponseDto,
  FileAccessResponseDto,
} from './dto/upload.dto';
import { JwtPayload } from 'src/common/interface/jwt-payload.interface';
import { UserType } from 'src/common/enum/user-type.enum';
import { ERROR_MESSAGES } from 'src/common/constant/error-messages.constant';

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

  constructor(
    @InjectRepository(FileEntity)
    private readonly fileRepo: Repository<FileEntity>,
    @InjectRepository(FileAccessEntity)
    private readonly fileAccessRepo: Repository<FileAccessEntity>,
    private readonly configService: ConfigService,
  ) {
    this.uploadDir = this.configService.get('UPLOAD_DIR') || 'uploads';
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
  ): Promise<UploadFileResponseDto> {
    if (!file) {
      throw new BadRequestException('Không có file nào được upload');
    }

    const fileEntity = this.fileRepo.create({
      originalName: file.originalname,
      filename: file.filename,
      path: file.path,
      mimetype: file.mimetype,
      size: file.size,
      fileType,
      uploadedBy: user.userId,
      description,
      createdBy: user.userId,
    });

    const saved = await this.fileRepo.save(fileEntity);
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

  /**
   * Tải file về (không kiểm tra quyền)
   */
  async downloadFile(
    filename: string,
  ): Promise<{ filePath: string; file: FileEntity }> {
    const file = await this.getFileByFilename(filename);

    const absolutePath = this.getAbsoluteFilePath(filename);
    if (!existsSync(absolutePath)) {
      throw new NotFoundException('File không tồn tại trên server');
    }

    return {
      filePath: absolutePath,
      file,
    };
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

  /**
   * Xóa file (có kiểm tra quyền)
   */
  async deleteFile(filename: string, user: JwtPayload): Promise<boolean> {
    const file = await this.getFileByFilename(filename);

    // Chỉ owner hoặc admin mới có thể xóa
    if (file.uploadedBy !== user.userId && user.userType !== UserType.ADMIN) {
      throw new ForbiddenException('Bạn không có quyền xóa file này');
    }

    // Xóa file vật lý
    const absolutePath = this.getAbsoluteFilePath(filename);
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
    // Note: `file.path` được lưu bởi multer là một đường dẫn tương đối như 'uploads/filename.ext'
    // Chúng ta cần một đường dẫn tuyệt đối để đảm bảo res.sendFile hoạt động đáng tin cậy
    return join(process.cwd(), this.uploadDir, filename);
  }

  /**
   * Lấy đường dẫn tương đối của file (giữ lại để tương thích nếu cần)
   */
  private getFilePath(filename: string): string {
    return join(this.uploadDir, filename);
  }
}
