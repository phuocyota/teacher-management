import { Open } from 'unzipper';
import { ExamZipReaderService } from './exam-zip-reader.service';

describe('ExamZipReaderService', () => {
  const service = new ExamZipReaderService();
  const openBuffer = (Open as unknown as { buffer: jest.Mock }).buffer;

  beforeEach(() => openBuffer.mockReset());

  it('reads one PDF and supported audio from the ZIP root', async () => {
    openBuffer.mockResolvedValue({
      files: [
        entry('exam.pdf', Buffer.from('%PDF-test')),
        entry('Audio 001.mp3', Buffer.from('ID3audio')),
        entry('notes.txt', Buffer.from('notes')),
        entry('__MACOSX/._exam.pdf', Buffer.from('ignored')),
      ],
    });

    const result = await service.inspect(Buffer.from('zip'));

    expect(result.pdf.originalName).toBe('exam.pdf');
    expect(result.audioFiles[0]).toMatchObject({
      originalName: 'Audio 001.mp3',
      mimetype: 'audio/mpeg',
      normalizedLabel: 'audio 001',
    });
    expect(result.warnings).toEqual([
      'Bỏ qua file không được hỗ trợ: notes.txt',
    ]);
  });

  it('rejects traversal, encrypted entries and multiple PDFs', async () => {
    openBuffer.mockResolvedValue({
      files: [entry('../exam.pdf', Buffer.from('x'))],
    });
    await expect(service.inspect(Buffer.from('zip'))).rejects.toThrow(
      'Đường dẫn ZIP không an toàn',
    );

    openBuffer.mockResolvedValue({
      files: [entry('exam.pdf', Buffer.from('x'), { flags: 1 })],
    });
    await expect(service.inspect(Buffer.from('zip'))).rejects.toThrow(
      'Không hỗ trợ file ZIP mã hóa',
    );

    openBuffer.mockResolvedValue({
      files: [
        entry('one.pdf', Buffer.from('x')),
        entry('two.pdf', Buffer.from('x')),
      ],
    });
    await expect(service.inspect(Buffer.from('zip'))).rejects.toThrow(
      'đúng một file PDF',
    );
  });

  it('rejects files placed inside a subdirectory', async () => {
    openBuffer.mockResolvedValue({
      files: [
        entry('exam.pdf', Buffer.from('%PDF-test')),
        entry('audio/Audio 001.mp3', Buffer.from('ID3audio')),
      ],
    });

    await expect(service.inspect(Buffer.from('zip'))).rejects.toThrow(
      'ZIP không được chứa thư mục con: audio/Audio 001.mp3',
    );
  });
});

function entry(
  path: string,
  buffer: Buffer,
  overrides: Record<string, number> = {},
) {
  return {
    path,
    type: 'File',
    uncompressedSize: buffer.length,
    ...overrides,
    buffer: jest.fn().mockResolvedValue(buffer),
  };
}
