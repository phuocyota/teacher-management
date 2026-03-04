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
import {
  GradeDetailResponseDto,
  GradeDetailListResponseDto,
  GradeListResponseDto,
  GradeResponseDto,
} from './dto/grade.dto';
import { PaginationResponseDto } from 'src/common/dto/pagination.dto';
import { RolesGuard } from 'src/common/guard/roles.guard';
import { Roles } from 'src/common/decorator/roles.decorator';
import { UserType } from 'src/common/enum/user-type.enum';
import { Public } from 'src/common/decorator/public.decorator';

@ApiTags('Grade')
@ApiBearerAuth('access-token')
@Controller('grade')
export class GradeController {
  constructor(private readonly gradeService: GradeService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserType.ADMIN)
  @ApiOperation({ summary: 'Tao moi Khoi' })
  @ApiCreatedResponse({ type: GradeResponseDto })
  create(@Body() dto: CreateGradeDto) {
    return this.gradeService.create(dto);
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'Lay danh sach Khoi' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'size', required: false, type: Number })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Tim kiem theo ten hoac ma',
  })
  @ApiQuery({
    name: 'isGetAllDetail',
    required: false,
    type: Boolean,
    description: 'Lay chi tiet mon hoc va bo de thi theo tung khoi',
  })
  @ApiOkResponse({ type: GradeListResponseDto })
  findAll(
    @Query('page') page?: number,
    @Query('size') size?: number,
    @Query('search') search?: string,
    @Query('isGetAllDetail') isGetAllDetail?: string,
  ): Promise<PaginationResponseDto<GradeResponseDto | GradeDetailResponseDto>> {
    return this.gradeService.findAll(page, size, search, isGetAllDetail);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lay thong tin Khoi theo ID' })
  @ApiOkResponse({ type: GradeResponseDto })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.gradeService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserType.ADMIN)
  @ApiOperation({ summary: 'Cap nhat thong tin Khoi' })
  @ApiOkResponse({ type: GradeResponseDto })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateGradeDto) {
    return this.gradeService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserType.ADMIN)
  @ApiOperation({ summary: 'Xoa Khoi' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.gradeService.remove(id);
  }
}
