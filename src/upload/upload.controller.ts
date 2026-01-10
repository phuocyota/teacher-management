import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  Get,
  Param,
  Res,
  Delete,
  Body,
  Req,
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
import type { Response, Request } from 'express';
import { UploadService } from './upload.service';
import {
  UploadFileResponseDto,
  UploadMultipleFilesResponseDto,
  GrantFileAccessDto,
  GrantFileAccessToManyDto,
  FileAccessResponseDto,
} from './dto/upload.dto';
import { UploadFolderResponseDto } from './dto/upload.dto';
import { FileType } from './enum/file-visibility.enum';
import { User } from 'src/common/decorator/user.decorator';
import type { JwtPayload } from 'src/common/interface/jwt-payload.interface';
import { UserType } from 'src/common/enum/user-type.enum';

// Interface cho Multer File đã được chuyển sang module, nhưng vẫn cần ở đây cho type hinting
interface MulterFile {
  originalname: string;
  filename: string;
  path: string;
  mimetype: string;
  size: number;
}

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
          enum: Object.values(FileType),
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
  @UseInterceptors(FileInterceptor('file'))
  async uploadSingleFile(
    @UploadedFile() file: MulterFile,
    @User() user: JwtPayload,
    @Body('fileType') fileType?: FileType,
    @Body('description') description?: string,
  ): Promise<UploadFileResponseDto> {
    return this.uploadService.handleFileUpload(
      file,
      user,
      fileType || FileType.NORMAL,
      description,
    );
  }

  @Post('large')
  @ApiOperation({ summary: 'Upload file lớn (tối đa 2GB)' })
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
          enum: Object.values(FileType),
          default: 'NORMAL',
          description: 'Loại file',
        },
        description: { type: 'string', description: 'Mô tả file' },
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
    FileInterceptor('file', { limits: { fileSize: 2147483648 } }),
  )
  async uploadLargeFile(
    @UploadedFile() file: MulterFile,
    @User() user: JwtPayload,
    @Body('fileType') fileType?: FileType,
    @Body('description') description?: string,
  ): Promise<UploadFileResponseDto> {
    return this.uploadService.handleFileUpload(
      file,
      user,
      fileType || FileType.NORMAL,
      description,
      true,
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
          enum: Object.values(FileType),
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
  @UseInterceptors(FilesInterceptor('files', 10))
  async uploadMultipleFiles(
    @UploadedFiles() files: MulterFile[],
    @User() user: JwtPayload,
    @Body('fileType') fileType?: FileType,
  ): Promise<UploadMultipleFilesResponseDto> {
    return this.uploadService.handleMultipleFilesUpload(
      files,
      user,
      fileType || FileType.NORMAL,
    );
  }

  @Post('folder')
  @ApiOperation({ summary: 'Upload một thư mục (giữ nguyên cấu trúc thư mục)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          description: 'Các file trong thư mục (kèm đường dẫn tương đối)',
        },
        fileType: {
          type: 'string',
          enum: Object.values(FileType),
          default: 'NORMAL',
          description: 'Loại file',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Upload folder thành công',
    type: UploadFolderResponseDto,
  })
  @UseInterceptors(FilesInterceptor('files', 1000, { preservePath: true }))
  async uploadFolder(
    @UploadedFiles() files: MulterFile[],
    @User() user: JwtPayload,
    @Body('fileType') fileType?: FileType,
  ): Promise<UploadFolderResponseDto> {
    return this.uploadService.handleFolderUpload(
      files,
      user,
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

  @Get(':id/download')
  async download(@Param('id') id: string, @Res() res: Response) {
    return this.uploadService.download(id, res);
  }

  @Get('list')
  @ApiOperation({ summary: 'Lấy danh sách file user có quyền truy cập' })
  @ApiResponse({
    status: 200,
    description: 'Danh sách file',
    type: [UploadFileResponseDto],
  })
  async listFiles(@User() user: JwtPayload): Promise<UploadFileResponseDto[]> {
    if (user.userType === UserType.ADMIN) {
      return this.uploadService.getAllFiles();
    }

    return this.uploadService.getAccessibleFiles(user);
  }

  @Get('download/:filename')
  async downloadByFilename(
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    const file = await this.uploadService.getFileByFilename(filename);
    return this.uploadService.download(file.id, res);
  }

  @Get('downloads/:filename/image')
  downloadFile(
    @Param('filename') filename: string,
    @User() user: JwtPayload,
    @Res() res: Response,
  ): void {
    const { filePath } = this.uploadService.downloadFile(filename);
    res.sendFile(filePath);
  }

  @Get('stream/:filename')
  async streamByFilename(
    @Param('filename') filename: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const file = await this.uploadService.getFileByFilename(filename);
    return this.uploadService.stream(file.id, req, res);
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
