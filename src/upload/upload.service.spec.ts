import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { UploadService } from './upload.service';
import { FileAccessType, FileType } from './enum/file-visibility.enum';
import { UserType } from 'src/common/enum/user-type.enum';

jest.mock('fs', () => {
  const actual = jest.requireActual('fs');
  return {
    ...actual,
    existsSync: jest.fn(() => true),
    mkdirSync: jest.fn(),
    renameSync: jest.fn(),
    statSync: jest.fn(() => ({ isDirectory: () => false, size: 10 })),
    writeFileSync: jest.fn(),
    appendFileSync: jest.fn(),
    readFileSync: jest.fn(() => Buffer.from('x')),
    readdirSync: jest.fn(() => []),
    rmSync: jest.fn(),
    createReadStream: jest.fn(() => ({ pipe: jest.fn(), on: jest.fn() })),
    createWriteStream: jest.fn(),
  };
});

describe('UploadService', () => {
  let service: UploadService;
  let fileRepo: any;
  let fileAccessRepo: any;
  let configService: any;
  let streamService: any;

  beforeEach(() => {
    fileRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      delete: jest.fn(),
    };
    fileAccessRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
    };
    configService = {
      get: jest.fn((key: string) => {
        if (key === 'UPLOAD_DIR') return 'uploads';
        if (key === 'PUBLIC_BASE_URL') return undefined;
        return undefined;
      }),
    };
    streamService = { getAbsoluteFilePath: jest.fn((p: string) => p) };

    service = new UploadService(
      fileRepo,
      fileAccessRepo,
      configService as any,
      streamService as any,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('handleFileUpload throws when file missing', async () => {
    await expect(
      service.handleFileUpload(undefined as any, { userId: 'u1' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('grantFileAccess forbids non-owner', async () => {
    jest
      .spyOn(service, 'getFileById')
      .mockResolvedValue({ id: 'f1', uploadedBy: 'owner' } as any);

    await expect(
      service.grantFileAccess('f1', 'u2', FileAccessType.READ, {
        userId: 'other',
        userType: UserType.TEACHER,
      } as any),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('getAccessibleFiles merges own and shared files', async () => {
    fileRepo.find
      .mockResolvedValueOnce([{ id: 'f1', createdAt: new Date(1) }])
      .mockResolvedValueOnce([{ id: 'f2', createdAt: new Date(2) }]);

    fileAccessRepo.find.mockResolvedValue([
      { fileId: 'f2', expiresAt: new Date(Date.now() + 1000) },
    ]);

    const result = await service.getAccessibleFiles({ userId: 'u1' } as any);

    expect(result).toHaveLength(2);
  });

  it('listFiles uses getAccessibleFiles for non-admin', async () => {
    jest
      .spyOn(service, 'getAccessibleFiles')
      .mockResolvedValue([
        { id: 'f1', originalName: 'a' } as any,
        { id: 'f2', originalName: 'b' } as any,
      ]);

    const result = await service.listFiles(
      { userId: 'u1', userType: UserType.TEACHER } as any,
      { page: 1, size: 1 } as any,
    );

    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(2);
  });

  it('ensureFolderPath throws on parent traversal', async () => {
    await expect(service.ensureFolderPath('../bad')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('initChunkedUpload creates session', async () => {
    const result = await service.initChunkedUpload(
      { fileName: 'a.txt', fileSize: 10, totalChunks: 2 } as any,
      { userId: 'u1' } as any,
    );

    expect(result.uploadId).toBeDefined();
    expect(result.totalChunks).toBe(2);
  });

  it('handleChunk throws when session missing', async () => {
    await expect(
      service.handleChunk('missing', 0, Buffer.from('x')),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('completeChunkedUpload rejects wrong user', async () => {
    const session = {
      fileName: 'a.txt',
      fileSize: 10,
      totalChunks: 1,
      receivedChunks: new Set([0]),
      userId: 'owner',
      fileType: FileType.NORMAL,
    };

    (service as any).uploadSessions.set('id1', session);

    await expect(
      service.completeChunkedUpload(
        { uploadId: 'id1', unzip: false } as any,
        { userId: 'other' } as any,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
