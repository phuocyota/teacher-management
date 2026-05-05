import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from 'src/common/decorator/roles.decorator';
import { UserType } from 'src/common/enum/user-type.enum';
import { RolesGuard } from 'src/common/guard/roles.guard';
import { PaginationResponseDto } from 'src/common/dto/pagination.dto';
import { CreateZoneDto, UpdateZoneDto } from './dto/create-zone.dto';
import {
  ZoneDetailListResponseDto,
  ZoneDetailResponseDto,
  ZoneListResponseDto,
  ZoneResponseDto,
} from './dto/zone.dto';
import { ZoneService } from './zone.service';
import { JwtPayload } from 'src/common/interface/jwt-payload.interface';
import { Request } from 'express';

interface RequestWithUser extends Request {
  user?: JwtPayload;
}

@ApiTags('Zone')
@ApiBearerAuth('access-token')
@Controller('zone')
export class ZoneController {
  constructor(private readonly zoneService: ZoneService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserType.ADMIN)
  @ApiOperation({ summary: 'Tao moi khu vuc' })
  @ApiCreatedResponse({ type: ZoneResponseDto })
  create(@Body() dto: CreateZoneDto) {
    return this.zoneService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lay danh sach khu vuc' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'size', required: false, type: Number })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Tim kiem theo ten hoac ma khu vuc',
  })
  @ApiQuery({
    name: 'isGetAllDetail',
    required: false,
    type: Boolean,
    description:
      'Lay chi tiet truong, nhom hoc sinh va thanh vien theo tung khu vuc',
  })
  @ApiOkResponse({ type: ZoneListResponseDto })
  @ApiOkResponse({ type: ZoneDetailListResponseDto })
  findAll(
    @Query('page') page?: number,
    @Query('size') size?: number,
    @Query('search') search?: string,
    @Query('isGetAllDetail') isGetAllDetail?: string,
    @Req() req?: RequestWithUser,
  ): Promise<PaginationResponseDto<ZoneResponseDto | ZoneDetailResponseDto>> {
    return this.zoneService.findAll(
      page,
      size,
      search,
      isGetAllDetail,
      req?.user,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lay thong tin khu vuc theo ID' })
  @ApiOkResponse({ type: ZoneResponseDto })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.zoneService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserType.ADMIN)
  @ApiOperation({ summary: 'Cap nhat thong tin khu vuc' })
  @ApiOkResponse({ type: ZoneResponseDto })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateZoneDto) {
    return this.zoneService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserType.ADMIN)
  @ApiOperation({ summary: 'Xoa khu vuc' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.zoneService.remove(id);
  }
}
