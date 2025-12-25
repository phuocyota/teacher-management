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
  FileAccessResponseDto,
} from './dto/upload.dto';
import { FileType } from './enum/file-visibility.enum';
import { User } from 'src/common/decorator/user.decorator';
import type { JwtPayload } from 'src/common/interface/jwt-payload.interface';

// Interface cho Multer File
interface MulterFile {
  originalname: string;
  filename: string;
  path: string;
  mimetype: string;
  size: number;
}

// Cấu hình storage cho Multer
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
        fileType: {
          type: 'string',
          enum: ['NORMAL', 'CONFIG'],
          default: 'NORMAL',
          description: 'Loại file',
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
    @Body('fileType') fileType?: FileType,
    @Body('description') description?: string,
  ): Promise<UploadFileResponseDto> {
    return this.uploadService.handleFileUpload(
      file,
      user,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      fileType || FileType.NORMAL,
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
        fileType: {
          type: 'string',
          enum: ['NORMAL', 'CONFIG'],
          default: 'NORMAL',
          description: 'Loại file',
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
    @Body('fileType') fileType?: FileType,
  ): Promise<UploadMultipleFilesResponseDto> {
    return this.uploadService.handleMultipleFilesUpload(
      files,
      user,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      fileType || FileType.NORMAL,
    );
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
  ): Promise<FileAccessResponseDto[]> {
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
  ): Promise<FileAccessResponseDto> {
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
  ): Promise<FileAccessResponseDto[]> {
    return this.uploadService.grantFileAccessToMany(
      fileId,
      dto.userIds,
      dto.accessType,
      user,
      dto.expiresAt ? new Date(dto.expiresAt) : undefined,
    );
  }

  @Get('download/:filename')
  @ApiOperation({ summary: 'Tải file về' })
  @ApiResponse({ status: 200, description: 'Trả về file' })
  @ApiResponse({ status: 403, description: 'Không có quyền tải file' })
  @ApiResponse({ status: 404, description: 'File không tồn tại' })
  async downloadFile(
    @Param('filename') filename: string,
    @Res() res: Response,
  ): Promise<void> {
    const { filePath } = await this.uploadService.downloadFile(filename);
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
