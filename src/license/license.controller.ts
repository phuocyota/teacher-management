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
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('License')
@Controller('licenses')
export class LicenseController {
  constructor(private readonly licenseService: LicenseService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new license' })
  @ApiResponse({ status: 201, description: 'License created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  async create(@Body() dto: CreateLicenseDto) {
    return this.licenseService.create(dto);
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
  async update(@Param('id') id: string, @Body() dto: UpdateLicenseDto) {
    return this.licenseService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete license' })
  @ApiResponse({ status: 204, description: 'License deleted successfully' })
  @ApiResponse({ status: 404, description: 'License not found' })
  async delete(@Param('id') id: string) {
    await this.licenseService.delete(id);
  }
}
