import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from 'src/common/decorator/public.decorator';
import { Roles } from 'src/common/decorator/roles.decorator';
import { UserType } from 'src/common/enum/user-type.enum';
import { RolesGuard } from 'src/common/guard/roles.guard';
import {
  AppVersionListItemDto,
  AppVersionResponseDto,
  CheckAppVersionQueryDto,
  CheckAppVersionResponseDto,
  CreateAppVersionDto,
  ListAppVersionsQueryDto,
} from './dto/app-update.dto';
import { VersionEntity } from './version.entity';
import { VersionService } from './version.service';

@ApiTags('App Update')
@Controller('app-update')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class VersionController {
  constructor(private readonly versionService: VersionService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserType.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Tạo phiên bản ứng dụng mới' })
  @ApiCreatedResponse({ type: AppVersionResponseDto })
  create(@Body() dto: CreateAppVersionDto): Promise<VersionEntity> {
    return this.versionService.create(dto);
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'Lấy danh sách phiên bản ứng dụng' })
  @ApiOkResponse({ type: AppVersionListItemDto, isArray: true })
  getList(
    @Query() query: ListAppVersionsQueryDto,
  ): Promise<AppVersionListItemDto[]> {
    return this.versionService.getList(query.platform);
  }

  @Get('latest')
  @Public()
  @ApiOperation({ summary: 'Kiểm tra phiên bản ứng dụng mới nhất' })
  @ApiOkResponse({ type: CheckAppVersionResponseDto })
  getLatest(
    @Query() query: CheckAppVersionQueryDto,
  ): Promise<CheckAppVersionResponseDto> {
    return this.versionService.getLatest(query.platform, query.currentVersion);
  }
}
