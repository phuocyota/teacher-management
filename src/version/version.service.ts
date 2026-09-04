import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AppVersionListItemDto,
  CheckAppVersionResponseDto,
  CreateAppVersionDto,
} from './dto/app-update.dto';
import { VersionEntity } from './version.entity';

const ANDROID_PLATFORM = 'android';

@Injectable()
export class VersionService {
  constructor(
    @InjectRepository(VersionEntity)
    private readonly versionRepository: Repository<VersionEntity>,
  ) {}

  async create(dto: CreateAppVersionDto): Promise<VersionEntity> {
    const existingVersion = await this.versionRepository.findOne({
      where: { platform: dto.platform, version: dto.version },
    });

    if (existingVersion) {
      throw new ConflictException(
        `Phiên bản ${dto.version} cho nền tảng ${dto.platform} đã tồn tại`,
      );
    }

    const entity = this.versionRepository.create({
      platform: dto.platform,
      version: dto.version,
      url: dto.downloadUrl,
      mandatory: dto.mandatory ?? false,
      note: dto.note ?? null,
    });

    return this.versionRepository.save(entity);
  }

  async getList(platform?: string): Promise<AppVersionListItemDto[]> {
    let versions: AppVersionListItemDto[] = await this.versionRepository.find({
      where: platform ? { platform } : undefined,
      order: { note: 'ASC' },
    });

    if (platform === ANDROID_PLATFORM) {
      versions = versions.map(({ note, ...version }) => ({
        ...version,
        name: note,
      }));
    }

    return versions;
  }

  async getLatest(
    platform: string,
    currentVersion: string,
  ): Promise<CheckAppVersionResponseDto> {
    const versions = await this.versionRepository.find({
      where: { platform },
    });
    const latest = versions.reduce<VersionEntity | null>((result, item) => {
      if (!result || compareVersions(item.version, result.version) > 0) {
        return item;
      }
      return result;
    }, null);
    const hasUpdate = Boolean(
      latest && compareVersions(latest.version, currentVersion) > 0,
    );

    return {
      hasUpdate,
      currentVersion,
      latestVersion: latest?.version ?? null,
      mandatory: hasUpdate ? latest!.mandatory : false,
      downloadUrl: hasUpdate ? latest!.url : null,
      note: hasUpdate ? latest!.note : null,
    };
  }
}

export function compareVersions(left: string, right: string): number {
  const [leftMain, leftPreRelease] = left.split('-', 2);
  const [rightMain, rightPreRelease] = right.split('-', 2);
  const leftParts = leftMain.split('.').map(Number);
  const rightParts = rightMain.split('.').map(Number);

  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] !== rightParts[index]) {
      return leftParts[index] > rightParts[index] ? 1 : -1;
    }
  }

  if (!leftPreRelease && !rightPreRelease) return 0;
  if (!leftPreRelease) return 1;
  if (!rightPreRelease) return -1;

  const leftIdentifiers = leftPreRelease.split('.');
  const rightIdentifiers = rightPreRelease.split('.');
  const identifierCount = Math.max(
    leftIdentifiers.length,
    rightIdentifiers.length,
  );

  for (let index = 0; index < identifierCount; index += 1) {
    const leftIdentifier = leftIdentifiers[index];
    const rightIdentifier = rightIdentifiers[index];
    if (leftIdentifier === undefined) return -1;
    if (rightIdentifier === undefined) return 1;
    if (leftIdentifier === rightIdentifier) continue;

    const leftIsNumber = /^\d+$/.test(leftIdentifier);
    const rightIsNumber = /^\d+$/.test(rightIdentifier);
    if (leftIsNumber && rightIsNumber) {
      return Number(leftIdentifier) > Number(rightIdentifier) ? 1 : -1;
    }
    if (leftIsNumber !== rightIsNumber) return leftIsNumber ? -1 : 1;
    return leftIdentifier > rightIdentifier ? 1 : -1;
  }

  return 0;
}
