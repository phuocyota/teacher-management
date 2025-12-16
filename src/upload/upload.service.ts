import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { FileEntity } from './entity/file.entity';
import { FileAccessEntity } from './entity/file-access.entity';
import { FileVisibility, FileAccessType } from './enum/file-visibility.enum';
import { LectureEntity } from 'src/lecture/entity/lecture.entity';
import { TeacherLecturePermissionEntity } from 'src/lecture/entity/teacher-lecture-permission.entity';
import { PermissionType } from 'src/lecture/enum/permission-type.enum';
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
  private readonly uploadDir = 'uploads';

  constructor(
    @InjectRepository(FileEntity)
    private readonly fileRepo: Repository<FileEntity>,
    @InjectRepository(FileAccessEntity)
    private readonly fileAccessRepo: Repository<FileAccessEntity>,
    @InjectRepository(LectureEntity)
    private readonly lectureRepo: Repository<LectureEntity>,
    @InjectRepository(TeacherLecturePermissionEntity)
    private readonly permissionRepo: Repository<TeacherLecturePermissionEntity>,
  ) {
    // Tạo thư mục uploads nếu chưa tồn tại
    this.ensureUploadDirExists();
  }

  /**
   * Đảm bảo thư mục upload tồn tại
   */
  private ensureUploadDirExists(): void {
    const uploadPath = join(process.cwd(), this.uploadDir);
    if (!existsSync(uploadPath)) {
      mkdirSync(uploadPath, { recursive: true });
    }
  }

  /**
   * Xử lý upload single file và lưu vào database
   */
  async handleFileUpload(
    file: MulterFile,
    user: JwtPayload,
    visibility: FileVisibility = FileVisibility.PRIVATE,
    description?: string,
  ): Promise<FileEntity> {
    if (!file) {
      throw new BadRequestException('Không có file nào được upload');
    }

    const fileEntity = this.fileRepo.create({
      originalName: file.originalname,
      filename: file.filename,
      path: file.path,
      mimetype: file.mimetype,
      size: file.size,
      visibility,
      uploadedBy: user.userId,
      description,
      createdBy: user.userId,
    });

    return this.fileRepo.save(fileEntity);
  }

  /**
   * Xử lý upload nhiều file
   */
  async handleMultipleFilesUpload(
    files: MulterFile[],
    user: JwtPayload,
    visibility: FileVisibility = FileVisibility.PRIVATE,
  ): Promise<{ files: FileEntity[]; totalFiles: number }> {
    if (!files || files.length === 0) {
      throw new BadRequestException('Không có file nào được upload');
    }

    const savedFiles: FileEntity[] = [];

    for (const file of files) {
      const fileEntity = await this.handleFileUpload(file, user, visibility);
      savedFiles.push(fileEntity);
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
   * Kiểm tra quyền truy cập file
   */
  async checkFileAccess(
    fileId: string,
    user: JwtPayload,
    requiredAccess: FileAccessType = FileAccessType.VIEW,
  ): Promise<boolean> {
    const file = await this.getFileById(fileId);

    // Admin có toàn quyền
    if (user.userType === UserType.ADMIN) {
      return true;
    }

    // Người upload có toàn quyền
    if (file.uploadedBy === user.userId) {
      return true;
    }

    // File công khai - ai cũng xem được
    if (file.visibility === FileVisibility.PUBLIC) {
      return requiredAccess === FileAccessType.VIEW;
    }

    // File riêng tư - chỉ người upload mới xem được
    if (file.visibility === FileVisibility.PRIVATE) {
      return false;
    }

    // File restricted - kiểm tra quyền được cấp
    if (file.visibility === FileVisibility.RESTRICTED) {
      const access = await this.fileAccessRepo.findOne({
        where: {
          fileId,
          userId: user.userId,
        },
      });

      if (!access) {
        return false;
      }

      // Kiểm tra hết hạn
      if (access.expiresAt && new Date(access.expiresAt) < new Date()) {
        return false;
      }

      // Kiểm tra loại quyền
      if (requiredAccess === FileAccessType.VIEW) {
        return true; // Mọi quyền đều có thể xem
      }

      if (requiredAccess === FileAccessType.DOWNLOAD) {
        return (
          access.accessType === FileAccessType.DOWNLOAD ||
          access.accessType === FileAccessType.FULL
        );
      }

      if (requiredAccess === FileAccessType.FULL) {
        return access.accessType === FileAccessType.FULL;
      }
    }

    return false;
  }

  /**
   * Tải file về (có kiểm tra quyền)
   */
  async downloadFile(
    filename: string,
    user: JwtPayload,
  ): Promise<{ filePath: string; file: FileEntity }> {
    const file = await this.getFileByFilename(filename);

    const hasAccess = await this.checkFileAccess(
      file.id,
      user,
      FileAccessType.DOWNLOAD,
    );

    if (!hasAccess) {
      throw new ForbiddenException('Bạn không có quyền tải file này');
    }

    return {
      filePath: this.getFilePath(filename),
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
  ): Promise<FileAccessEntity> {
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

    return this.fileAccessRepo.save(access);
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
  ): Promise<FileAccessEntity[]> {
    const results: FileAccessEntity[] = [];

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
   * Thu hồi quyền truy cập file
   */
  async revokeFileAccess(
    fileId: string,
    userId: string,
    revokedBy: JwtPayload,
  ): Promise<void> {
    const file = await this.getFileById(fileId);

    // Chỉ owner hoặc admin mới có thể thu hồi quyền
    if (
      file.uploadedBy !== revokedBy.userId &&
      revokedBy.userType !== UserType.ADMIN
    ) {
      throw new ForbiddenException(
        'Bạn không có quyền thu hồi quyền truy cập file này',
      );
    }

    await this.fileAccessRepo.delete({ fileId, userId });
  }

  /**
   * Lấy danh sách quyền truy cập của file
   */
  async getFileAccessList(
    fileId: string,
    user: JwtPayload,
  ): Promise<FileAccessEntity[]> {
    const file = await this.getFileById(fileId);

    // Chỉ owner hoặc admin mới có thể xem danh sách quyền
    if (file.uploadedBy !== user.userId && user.userType !== UserType.ADMIN) {
      throw new ForbiddenException(
        'Bạn không có quyền xem danh sách quyền truy cập',
      );
    }

    return this.fileAccessRepo.find({
      where: { fileId },
      relations: ['file'],
    });
  }

  /**
   * Cập nhật visibility của file
   */
  async updateFileVisibility(
    fileId: string,
    visibility: FileVisibility,
    user: JwtPayload,
  ): Promise<FileEntity> {
    const file = await this.getFileById(fileId);

    // Chỉ owner hoặc admin mới có thể thay đổi visibility
    if (file.uploadedBy !== user.userId && user.userType !== UserType.ADMIN) {
      throw new ForbiddenException(
        'Bạn không có quyền thay đổi visibility của file này',
      );
    }

    file.visibility = visibility;
    file.updatedBy = user.userId;

    return this.fileRepo.save(file);
  }

  /**
   * Lấy danh sách file của user
   */
  async getMyFiles(user: JwtPayload): Promise<FileEntity[]> {
    return this.fileRepo.find({
      where: { uploadedBy: user.userId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Lấy danh sách file user có quyền truy cập
   */
  async getAccessibleFiles(user: JwtPayload): Promise<FileEntity[]> {
    // Lấy file công khai
    const publicFiles = await this.fileRepo.find({
      where: { visibility: FileVisibility.PUBLIC },
    });

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
    const allFiles = [...publicFiles, ...myFiles, ...restrictedFiles];
    const uniqueFiles = allFiles.filter(
      (file, index, self) => index === self.findIndex((f) => f.id === file.id),
    );

    return uniqueFiles.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
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
    const filePath = join(process.cwd(), this.uploadDir, filename);
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }

    // Xóa trong database (cascade sẽ xóa cả file_access)
    await this.fileRepo.delete({ id: file.id });

    return true;
  }

  /**
   * Lấy đường dẫn đầy đủ của file
   */
  getFilePath(filename: string): string {
    return join(process.cwd(), this.uploadDir, filename);
  }

  /**
   * Upload file dưới dạng bài giảng
   * Luồng: Upload file → Tạo record file → Tạo record lecture → Cấp quyền cho giáo viên
   * Sử dụng transaction để đảm bảo tính nhất quán của dữ liệu
   */
  async uploadLectureFile(
    file: MulterFile,
    lectureTitle: string,
    lectureDescription: string | undefined,
    teacherIds: string[] | undefined,
    user: JwtPayload,
    fileDescription?: string,
  ): Promise<{
    fileId: string;
    lectureId: string;
    filename: string;
    originalName: string;
    size: number;
    lectureTitle: string;
    teachersGranted: number;
    createdAt: Date;
  }> {
    if (!file) {
      throw new BadRequestException('Không có file nào được upload');
    }

    // Sử dụng transaction để đảm bảo tính nhất quán
    return this.fileRepo.manager.connection.transaction(async (manager) => {
      // Bước 1: Tạo record file
      const fileEntity = this.fileRepo.create({
        originalName: file.originalname,
        filename: file.filename,
        path: file.path,
        mimetype: file.mimetype,
        size: file.size,
        visibility: FileVisibility.PRIVATE,
        uploadedBy: user.userId,
        description: fileDescription,
        createdBy: user.userId,
      });

      const savedFile = await manager.save(fileEntity);

      // Bước 2: Tạo record lecture
      const lecture = this.lectureRepo.create({
        title: lectureTitle,
        description: lectureDescription,
        fileId: savedFile.id,
        createdBy: user.userId,
      });

      const savedLecture = await manager.save(lecture);

      // Bước 3: Cấp quyền cho giáo viên (nếu có)
      let teachersGranted = 0;
      if (teacherIds && teacherIds.length > 0) {
        // Kiểm tra giáo viên tồn tại
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const teachers = await manager.query(
          `SELECT id FROM "user" WHERE id = ANY($1)`,
          [teacherIds],
        );

        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (teachers.length !== teacherIds.length) {
          throw new BadRequestException('Một số giáo viên không tồn tại');
        }

        // Tạo permission records
        for (const teacherId of teacherIds) {
          const permission = this.permissionRepo.create({
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            lectureId: savedLecture.id,
            teacherId,
            permissionType: PermissionType.VIEW,
            grantedBy: user.userId,
          });
          await manager.save(permission);
          teachersGranted++;
        }
      }

      return {
        fileId: savedFile.id,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        lectureId: savedLecture.id,
        filename: savedFile.filename,
        originalName: savedFile.originalName,
        size: savedFile.size,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        lectureTitle: savedLecture.title,
        teachersGranted,
        createdAt: savedFile.createdAt,
      };
    });
  }
}
