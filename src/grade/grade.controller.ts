import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiQuery,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiOperation,
} from '@nestjs/swagger';
import { GradeService } from './grade.service';
import { CreateGradeDto, UpdateGradeDto } from './dto/create-grade.dto';
import { GradeResponseDto, GradeListResponseDto } from './dto/grade.dto';
import { PaginationResponseDto } from 'src/common/dto/pagination.dto';
import { RolesGuard } from 'src/common/guard/roles.guard';
import { Roles } from 'src/common/decorator/roles.decorator';
import { UserType } from 'src/common/enum/user-type.enum';

@ApiTags('Grade')
@ApiBearerAuth('access-token')
@Controller('grade')
export class GradeController {
  constructor(private readonly gradeService: GradeService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserType.ADMIN)
  @ApiOperation({ summary: 'Tao moi Khối' })
  @ApiCreatedResponse({ type: GradeResponseDto })
  create(@Body() dto: CreateGradeDto) {
    return this.gradeService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lay danh sach Khối' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'size', required: false, type: Number })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Tim kiem theo ten hoac ma',
  })
  @ApiOkResponse({ type: GradeListResponseDto })
  findAll(
    @Query('page') page?: number,
    @Query('size') size?: number,
    @Query('search') search?: string,
  ): Promise<PaginationResponseDto<GradeResponseDto>> {
    return this.gradeService.findAll(page, size, search);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lay thong tin Khối theo ID' })
  @ApiOkResponse({ type: GradeResponseDto })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.gradeService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserType.ADMIN)
  @ApiOperation({ summary: 'Cap nhat thong tin Khối' })
  @ApiOkResponse({ type: GradeResponseDto })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateGradeDto) {
    return this.gradeService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserType.ADMIN)
  @ApiOperation({ summary: 'Xoa Khối' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.gradeService.remove(id);
  }
}
