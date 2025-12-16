import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
} from '@nestjs/common';
import { LicenseService } from './license.service';
import { CreateLicenseDto, UpdateLicenseDto } from './dto/license.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { User } from 'src/common/decorator/user.decorator';
import type { JwtPayload } from 'src/common/interface/jwt-payload.interface';

@ApiTags('License')
@ApiBearerAuth('access-token')
@Controller('licenses')
export class LicenseController {
  constructor(private readonly licenseService: LicenseService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new license' })
  @ApiResponse({ status: 201, description: 'License created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  async create(@Body() dto: CreateLicenseDto, @User() user: JwtPayload) {
    return this.licenseService.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'Get all licenses (with pagination)' })
  @ApiResponse({ status: 200, description: 'List of licenses' })
  async findAll() {
    return this.licenseService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get license by ID' })
  @ApiResponse({ status: 200, description: 'License found' })
  @ApiResponse({ status: 404, description: 'License not found' })
  async findOne(@Param('id') id: string) {
    return this.licenseService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a license' })
  @ApiResponse({ status: 200, description: 'License updated successfully' })
  @ApiResponse({ status: 404, description: 'License not found' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateLicenseDto,
    @User() user: JwtPayload,
  ) {
    return this.licenseService.update(id, dto as any, user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete license' })
  @ApiResponse({ status: 204, description: 'License deleted successfully' })
  @ApiResponse({ status: 404, description: 'License not found' })
  async delete(@Param('id') id: string, @User() user: JwtPayload) {
    await this.licenseService.delete(id, user);
  }
}
