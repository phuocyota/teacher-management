import { NotFoundException } from '@nestjs/common';
import { join, normalize } from 'path';
import { StreamService } from './stream.service';

describe('StreamService', () => {
  let service: StreamService;
  let fileRepo: any;
  let configService: any;

  beforeEach(() => {
    fileRepo = { findOne: jest.fn() };
    configService = { get: jest.fn().mockReturnValue('uploads') };
    service = new StreamService(fileRepo, configService as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('getAbsoluteFilePath returns absolute path for absolute input', () => {
    const input = '/tmp/file.txt';
    const result = service.getAbsoluteFilePath(input);
    expect(result).toBe(normalize(input));
  });

  it('getAbsoluteFilePath resolves relative path with uploadDir', () => {
    const input = 'uploads/abc.txt';
    const result = service.getAbsoluteFilePath(input);
    expect(result).toBe(join(process.cwd(), 'uploads', 'abc.txt'));
  });

  it('getAbsoluteFilePath resolves URL path', () => {
    const input = 'http://example.com/uploads/folder/file.txt';
    const result = service.getAbsoluteFilePath(input);
    expect(result).toBe(join(process.cwd(), 'uploads', 'folder/file.txt'));
  });

  it('download throws when file not found', async () => {
    fileRepo.findOne.mockResolvedValue(null);

    await expect(service.download('missing', {} as any)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
