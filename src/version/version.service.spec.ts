import { ConflictException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { VersionEntity } from './version.entity';
import { compareVersions, VersionService } from './version.service';

describe('VersionService', () => {
  let repository: jest.Mocked<
    Pick<Repository<VersionEntity>, 'find' | 'findOne' | 'create' | 'save'>
  >;
  let service: VersionService;

  beforeEach(() => {
    repository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    service = new VersionService(repository as Repository<VersionEntity>);
  });

  it('chọn đúng phiên bản mới nhất theo semantic version', async () => {
    repository.find.mockResolvedValue([
      {
        id: '1',
        platform: 'mac',
        version: '1.9.0',
        url: 'url-1',
        mandatory: false,
        note: null,
      },
      {
        id: '2',
        platform: 'mac',
        version: '1.10.0',
        url: 'url-2',
        mandatory: true,
        note: 'Cập nhật bắt buộc',
      },
    ]);

    await expect(service.getLatest('mac', '1.9.0')).resolves.toEqual({
      hasUpdate: true,
      currentVersion: '1.9.0',
      latestVersion: '1.10.0',
      mandatory: true,
      downloadUrl: 'url-2',
      note: 'Cập nhật bắt buộc',
    });
  });

  it('không trả URL khi ứng dụng đang dùng phiên bản mới nhất', async () => {
    repository.find.mockResolvedValue([
      {
        id: '1',
        platform: 'mac',
        version: '1.0.2',
        url: 'url-1',
        mandatory: true,
        note: 'Ghi chú',
      },
    ]);

    await expect(service.getLatest('mac', '1.0.2')).resolves.toEqual({
      hasUpdate: false,
      currentVersion: '1.0.2',
      latestVersion: '1.0.2',
      mandatory: false,
      downloadUrl: null,
      note: null,
    });
  });

  it('từ chối phiên bản trùng trên cùng nền tảng', async () => {
    repository.findOne.mockResolvedValue({
      id: '1',
      platform: 'mac',
      version: '1.0.2',
      url: 'url-1',
      mandatory: false,
      note: null,
    });

    await expect(
      service.create({
        platform: 'mac',
        version: '1.0.2',
        downloadUrl: 'https://domain.com/release.zip',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('compareVersions', () => {
  it.each([
    ['1.10.0', '1.9.0', 1],
    ['2.0.0', '1.99.99', 1],
    ['1.0.0', '1.0.0', 0],
    ['1.0.0-beta.2', '1.0.0-beta.10', -1],
    ['1.0.0', '1.0.0-rc.1', 1],
  ])('so sánh %s với %s', (left, right, expected) => {
    expect(compareVersions(left, right)).toBe(expected);
  });
});
