import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ClassService } from './class.service';
import { CreateClassDto, UpdateClassDto } from './create-class.dto';

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
  findAll() {
    return this.classService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.classService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateClassDto) {
    return this.classService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.classService.remove(id);
  }
}
