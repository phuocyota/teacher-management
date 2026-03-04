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
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiQuery,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiOperation,
} from '@nestjs/swagger';
import { SubjectService } from './subject.service';
import { CreateSubjectDto, UpdateSubjectDto } from './dto/create-subject.dto';
import { SubjectResponseDto, SubjectListResponseDto } from './dto/subject.dto';
import { PaginationResponseDto } from 'src/common/dto/pagination.dto';
import { Public } from 'src/common/decorator/public.decorator';

@ApiTags('Subject')
@Controller('subject')
export class SubjectController {
  constructor(private readonly subjectService: SubjectService) {}

  @Post()
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Tao moi mon hoc' })
  @ApiCreatedResponse({ type: SubjectResponseDto })
  create(@Body() dto: CreateSubjectDto) {
    return this.subjectService.create(dto);
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'Lay danh sach mon hoc' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'size', required: false, type: Number })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Tim kiem theo ten hoac ma',
  })
  @ApiOkResponse({ type: SubjectListResponseDto })
  findAll(
    @Query('page') page?: number,
    @Query('size') size?: number,
    @Query('search') search?: string,
  ): Promise<PaginationResponseDto<SubjectResponseDto>> {
    return this.subjectService.findAll(page, size, search);
  }

  @Get(':id')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Lay thong tin mon hoc theo ID' })
  @ApiOkResponse({ type: SubjectResponseDto })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.subjectService.findOne(id);
  }

  @Patch(':id')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Cap nhat thong tin mon hoc' })
  @ApiOkResponse({ type: SubjectResponseDto })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSubjectDto) {
    return this.subjectService.update(id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Xoa mon hoc' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.subjectService.remove(id);
  }
}
