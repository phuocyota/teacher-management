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
  Query,
  ParseUUIDPipe,
  ParseIntPipe,
  BadRequestException,
} from '@nestjs/common';
import { readFileSync } from 'fs';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import type { Response, Request } from 'express';
import { UploadService } from './upload.service';
import {
  UploadFileResponseDto,
  UploadMultipleFilesResponseDto,
  GrantFileAccessDto,
  GrantFileAccessToManyDto,
  FileAccessResponseDto,
  UploadFolderResponseDto,
  CreateFolderPathDto,
  FolderPathResponseDto,
  InitUploadDto,
  InitUploadResponseDto,
  CompleteUploadDto,
  CompleteUploadResponseDto,
} from './dto/upload.dto';
import { FileType } from './enum/file-visibility.enum';
import { User } from 'src/common/decorator/user.decorator';
import type { JwtPayload } from 'src/common/interface/jwt-payload.interface';
import {
  PaginationRequestDto,
  PaginationResponseDto,
} from 'src/common/dto/pagination.dto';

// Interface cho Multer File đã được chuyển sang module, nhưng vẫn cần ở đây cho type hinting
interface MulterFile {
  originalname: string;
  filename: string;
  path: string;
  mimetype: string;
  size: number;
  buffer?: Buffer;
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

  @Post('folder/path')
  @ApiOperation({ summary: 'Đảm bảo thư mục tồn tại trong storage' })
  @ApiResponse({
    status: 200,
    description: 'Đường dẫn thư mục đã tồn tại hoặc được tạo',
    type: FolderPathResponseDto,
  })
  async ensureFolderPath(
    @Body() dto: CreateFolderPathDto,
  ): Promise<FolderPathResponseDto> {
    return this.uploadService.ensureFolderPath(dto.path);
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
    @Param('fileId', ParseUUIDPipe) fileId: string,
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
    @Param('fileId', ParseUUIDPipe) fileId: string,
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
  async download(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    return this.uploadService.download(id, res);
  }

  @Get('list')
  @ApiOperation({ summary: 'Lấy danh sách file user có quyền truy cập' })
  @ApiResponse({
    status: 200,
    description: 'Danh sách file phân trang',
    type: PaginationResponseDto<UploadFileResponseDto>,
  })
  async listFiles(
    @User() user: JwtPayload,
    @Query() pagination: PaginationRequestDto,
  ): Promise<PaginationResponseDto<UploadFileResponseDto>> {
    return this.uploadService.listFiles(user, pagination);
  }

  @Get('download/:filename')
  async downloadByFilename(
    @Param('filename', ParseUUIDPipe) filename: string,
    @Res() res: Response,
  ) {
    const file = await this.uploadService.getFileByFilename(filename);
    return this.uploadService.download(file.id, res);
  }

  @Get('downloads/:filename/image')
  downloadFile(
    @Param('filename', ParseUUIDPipe) filename: string,
    @User() user: JwtPayload,
    @Res() res: Response,
  ): void {
    const { filePath } = this.uploadService.downloadFile(filename);
    res.sendFile(filePath);
  }

  @Get('stream/:filename')
  async streamByFilename(
    @Param('filename', ParseUUIDPipe) filename: string,
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
    @Param('filename', ParseUUIDPipe) filename: string,
    @User() user: JwtPayload,
  ): Promise<{ message: string; filename: string }> {
    await this.uploadService.deleteFile(filename, user);
    return { message: 'Xóa file thành công', filename };
  }

  // ====== CHUNKED UPLOAD APIs ======

  @Post('init')
  @ApiOperation({ summary: 'Khởi tạo chunked upload session' })
  @ApiResponse({
    status: 201,
    description: 'Khởi tạo upload session thành công',
    type: InitUploadResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  async initChunkedUpload(
    @Body() dto: InitUploadDto,
    @User() user: JwtPayload,
  ): Promise<InitUploadResponseDto> {
    return this.uploadService.initChunkedUpload(dto, user);
  }

  @Post('chunk/:uploadId/:chunkIndex')
  @ApiOperation({ summary: 'Upload một chunk' })
  @ApiConsumes('multipart/form-data')
  @ApiParam({ name: 'uploadId', description: 'ID của upload session' })
  @ApiParam({
    name: 'chunkIndex',
    description: 'Index của chunk (bắt đầu từ 0)',
    type: Number,
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        chunk: {
          type: 'string',
          format: 'binary',
          description: 'Chunk data',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Upload chunk thành công',
    schema: {
      type: 'object',
      properties: {
        received: { type: 'number', description: 'Số chunk đã nhận' },
        total: { type: 'number', description: 'Tổng số chunk' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Upload session không tồn tại' })
  @UseInterceptors(FileInterceptor('chunk'))
  async uploadChunk(
    @Param('uploadId') uploadId: string,
    @Param('chunkIndex', ParseIntPipe) chunkIndex: number,
    @UploadedFile() file: MulterFile,
    @Req() req: Request,
  ): Promise<{ received: number; total: number }> {
    // Debug logging
    console.log('=== Upload Chunk Debug ===');
    console.log('uploadId:', uploadId);
    console.log('chunkIndex:', chunkIndex);
    console.log('file:', file);
    console.log('content-type:', req.headers['content-type']);
    console.log('body keys:', Object.keys(req.body || {}));
    console.log('========================');

    if (!file) {
      throw new BadRequestException(
        `Chunk không hợp lệ. File field name phải là "chunk". Content-Type: ${req.headers['content-type']}`,
      );
    }

    // Đọc chunk data từ file (vì dùng diskStorage)
    let chunkData: Buffer;
    if (file.buffer) {
      // Nếu có buffer (memoryStorage)
      chunkData = file.buffer;
    } else if (file.path) {
      // Đọc từ disk (diskStorage)
      chunkData = readFileSync(file.path);
    } else {
      throw new BadRequestException('Không thể đọc chunk data');
    }

    return this.uploadService.handleChunk(uploadId, chunkIndex, chunkData);
  }

  @Post('complete')
  @ApiOperation({ summary: 'Hoàn thành chunked upload và merge các chunks' })
  @ApiResponse({
    status: 201,
    description: 'Upload hoàn thành thành công',
    type: CompleteUploadResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Upload session không tồn tại' })
  @ApiResponse({
    status: 403,
    description: 'Không có quyền hoàn thành upload này',
  })
  @ApiResponse({ status: 400, description: 'Chưa nhận đủ chunks' })
  async completeChunkedUpload(
    @Body() dto: CompleteUploadDto,
    @User() user: JwtPayload,
  ): Promise<CompleteUploadResponseDto> {
    return this.uploadService.completeChunkedUpload(dto, user);
  }
}
