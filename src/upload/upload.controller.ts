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
