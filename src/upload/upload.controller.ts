import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  BadRequestException,
  Get,
  Param,
  Res,
  Delete,
  Body,
  Patch,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { extname } from 'path';
import type { Response } from 'express';
import { UploadService } from './upload.service';
import {
  UploadFileResponseDto,
  UploadMultipleFilesResponseDto,
  GrantFileAccessDto,
  GrantFileAccessToManyDto,
  UpdateFileVisibilityDto,
  FileAccessResponseDto,
} from './dto/upload.dto';
import { FileVisibility } from './enum/file-visibility.enum';
import { User } from 'src/common/decorator/user.decorator';
import type { JwtPayload } from 'src/common/interface/jwt-payload.interface';
import { FileEntity } from './entity/file.entity';
import { FileAccessEntity } from './entity/file-access.entity';

// Interface cho Multer File
interface MulterFile {
  originalname: string;
  filename: string;
  path: string;
  mimetype: string;
  size: number;
}

// Cấu hình storage cho Multer
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
const storage = diskStorage({
  destination: './uploads',
  filename: (
    _req: unknown,
    file: MulterFile,
    callback: (error: Error | null, filename: string) => void,
  ) => {
    // Tạo tên file unique: timestamp-originalname
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = extname(file.originalname);
    const filename = `${uniqueSuffix}${ext}`;
    callback(null, filename);
  },
});

// Filter file types
const fileFilter = (
  _req: unknown,
  file: MulterFile,
  callback: (error: Error | null, acceptFile: boolean) => void,
) => {
  // Cho phép các loại file phổ biến
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
  ];

  if (allowedMimes.includes(file.mimetype)) {
    callback(null, true);
  } else {
    callback(
      new BadRequestException(
        `Loại file không được hỗ trợ: ${file.mimetype}. Các loại file được phép: images, pdf, documents, excel, powerpoint, txt, zip, rar`,
      ),
      false,
    );
  }
};

@ApiTags('Upload')
@ApiBearerAuth('access-token')
@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('single')
  @ApiOperation({ summary: 'Upload một file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'File cần upload',
        },
        visibility: {
          type: 'string',
          enum: ['PUBLIC', 'PRIVATE', 'RESTRICTED'],
          default: 'PRIVATE',
          description: 'Mức độ hiển thị của file',
        },
        description: {
          type: 'string',
          description: 'Mô tả file',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Upload file thành công',
    type: UploadFileResponseDto,
  })
  @ApiResponse({ status: 400, description: 'File không hợp lệ' })
  @UseInterceptors(
    FileInterceptor('file', {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      storage,
      fileFilter,
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
    }),
  )
  async uploadSingleFile(
    @UploadedFile() file: MulterFile,
    @User() user: JwtPayload,
    @Body('visibility') visibility?: FileVisibility,
    @Body('description') description?: string,
  ): Promise<FileEntity> {
    return this.uploadService.handleFileUpload(
      file,
      user,
      visibility || FileVisibility.PRIVATE,
      description,
    );
  }

  @Post('multiple')
  @ApiOperation({ summary: 'Upload nhiều file (tối đa 10 file)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
          description: 'Danh sách file cần upload (tối đa 10 file)',
        },
        visibility: {
          type: 'string',
          enum: ['PUBLIC', 'PRIVATE', 'RESTRICTED'],
          default: 'PRIVATE',
          description: 'Mức độ hiển thị của files',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Upload files thành công',
    type: UploadMultipleFilesResponseDto,
  })
  @ApiResponse({ status: 400, description: 'File không hợp lệ' })
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      storage,
      fileFilter,
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB per file
      },
    }),
  )
  async uploadMultipleFiles(
    @UploadedFiles() files: MulterFile[],
    @User() user: JwtPayload,
    @Body('visibility') visibility?: FileVisibility,
  ): Promise<{ files: FileEntity[]; totalFiles: number }> {
    return this.uploadService.handleMultipleFilesUpload(
      files,
      user,
      visibility || FileVisibility.PRIVATE,
    );
  }

  @Get('my-files')
  @ApiOperation({ summary: 'Lấy danh sách file của tôi' })
  @ApiResponse({ status: 200, description: 'Danh sách file' })
  async getMyFiles(@User() user: JwtPayload): Promise<FileEntity[]> {
    return this.uploadService.getMyFiles(user);
  }

  @Get('accessible')
  @ApiOperation({ summary: 'Lấy danh sách file tôi có quyền truy cập' })
  @ApiResponse({ status: 200, description: 'Danh sách file' })
  async getAccessibleFiles(@User() user: JwtPayload): Promise<FileEntity[]> {
    return this.uploadService.getAccessibleFiles(user);
  }

  @Get(':fileId/access')
  @ApiOperation({ summary: 'Lấy danh sách quyền truy cập của file' })
  @ApiResponse({
    status: 200,
    description: 'Danh sách quyền truy cập',
    type: [FileAccessResponseDto],
  })
  @ApiResponse({ status: 403, description: 'Không có quyền' })
  async getFileAccessList(
    @Param('fileId') fileId: string,
    @User() user: JwtPayload,
  ): Promise<FileAccessEntity[]> {
    return this.uploadService.getFileAccessList(fileId, user);
  }

  @Post(':fileId/access')
  @ApiOperation({ summary: 'Cấp quyền truy cập file cho user' })
  @ApiResponse({
    status: 201,
    description: 'Cấp quyền thành công',
    type: FileAccessResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Không có quyền' })
  async grantFileAccess(
    @Param('fileId') fileId: string,
    @Body() dto: GrantFileAccessDto,
    @User() user: JwtPayload,
  ): Promise<FileAccessEntity> {
    return this.uploadService.grantFileAccess(
      fileId,
      dto.userId,
      dto.accessType,
      user,
      dto.expiresAt ? new Date(dto.expiresAt) : undefined,
    );
  }

  @Post(':fileId/access/batch')
  @ApiOperation({ summary: 'Cấp quyền truy cập file cho nhiều users' })
  @ApiResponse({
    status: 201,
    description: 'Cấp quyền thành công',
    type: [FileAccessResponseDto],
  })
  @ApiResponse({ status: 403, description: 'Không có quyền' })
  async grantFileAccessToMany(
    @Param('fileId') fileId: string,
    @Body() dto: GrantFileAccessToManyDto,
    @User() user: JwtPayload,
  ): Promise<FileAccessEntity[]> {
    return this.uploadService.grantFileAccessToMany(
      fileId,
      dto.userIds,
      dto.accessType,
      user,
      dto.expiresAt ? new Date(dto.expiresAt) : undefined,
    );
  }

  @Delete(':fileId/access/:userId')
  @ApiOperation({ summary: 'Thu hồi quyền truy cập file của user' })
  @ApiResponse({ status: 200, description: 'Thu hồi quyền thành công' })
  @ApiResponse({ status: 403, description: 'Không có quyền' })
  async revokeFileAccess(
    @Param('fileId') fileId: string,
    @Param('userId') userId: string,
    @User() user: JwtPayload,
  ): Promise<{ message: string }> {
    await this.uploadService.revokeFileAccess(fileId, userId, user);
    return { message: 'Thu hồi quyền truy cập thành công' };
  }

  @Patch(':fileId/visibility')
  @ApiOperation({ summary: 'Cập nhật visibility của file' })
  @ApiResponse({ status: 200, description: 'Cập nhật thành công' })
  @ApiResponse({ status: 403, description: 'Không có quyền' })
  async updateFileVisibility(
    @Param('fileId') fileId: string,
    @Body() dto: UpdateFileVisibilityDto,
    @User() user: JwtPayload,
  ): Promise<FileEntity> {
    return this.uploadService.updateFileVisibility(
      fileId,
      dto.visibility,
      user,
    );
  }

  @Get('download/:filename')
  @ApiOperation({ summary: 'Tải file về (có kiểm tra quyền)' })
  @ApiResponse({ status: 200, description: 'Trả về file' })
  @ApiResponse({ status: 403, description: 'Không có quyền tải file' })
  @ApiResponse({ status: 404, description: 'File không tồn tại' })
  async downloadFile(
    @Param('filename') filename: string,
    @User() user: JwtPayload,
    @Res() res: Response,
  ): Promise<void> {
    const { filePath } = await this.uploadService.downloadFile(filename, user);
    res.sendFile(filePath);
  }

  @Delete(':filename')
  @ApiOperation({ summary: 'Xóa file' })
  @ApiResponse({ status: 200, description: 'Xóa file thành công' })
  @ApiResponse({ status: 403, description: 'Không có quyền xóa file' })
  @ApiResponse({ status: 404, description: 'File không tồn tại' })
  async deleteFile(
    @Param('filename') filename: string,
    @User() user: JwtPayload,
  ): Promise<{ message: string; filename: string }> {
    await this.uploadService.deleteFile(filename, user);
    return { message: 'Xóa file thành công', filename };
  }
}
