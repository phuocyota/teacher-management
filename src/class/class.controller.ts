import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOkResponse } from '@nestjs/swagger';
import { ClassService } from './class.service';
import { CreateClassDto, UpdateClassDto } from './dto/create-class.dto';
import type { JwtPayload } from 'src/common/interface/jwt-payload.interface';
import { User } from 'src/common/decorator/user.decorator';
import { MaxCodeResponseDto } from 'src/common/dto/base.dto';

@ApiTags('Class')
@ApiBearerAuth('access-token')
@Controller('classes')
export class ClassController {
  constructor(private readonly classService: ClassService) {}

  @Post()
  create(@Body() dto: CreateClassDto) {
    return this.classService.create(dto);
  }

  @Get()
  findAll(@User() user: JwtPayload) {
    return this.classService.findAll(user);
  }

  @Get('max-code')
  @ApiOkResponse({ type: MaxCodeResponseDto })
  async getMaxCode(): Promise<MaxCodeResponseDto> {
    const maxCode = await this.classService.getMaxCode();
    return { maxCode };
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.classService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateClassDto) {
    return this.classService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @User() user: JwtPayload) {
    return this.classService.remove(id, user);
  }
}
