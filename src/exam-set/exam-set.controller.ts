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
import { ExamSetService } from './exam-set.service';
import { CreateExamSetDto, UpdateExamSetDto } from './dto/create-exam-set.dto';
import {
  ExamSetDetailResponseDto,
  ExamSetListResponseDto,
  ExamSetResponseDto,
} from './dto/exam-set.dto';
import { PaginationResponseDto } from 'src/common/dto/pagination.dto';
import { ExamSetStatus } from './enum/exam-set-status.enum';
import { Public } from 'src/common/decorator/public.decorator';

@ApiTags('Exam Set')
@ApiBearerAuth('access-token')
@Controller('exam-set')
export class ExamSetController {
  constructor(private readonly examSetService: ExamSetService) {}

  @Post()
  @ApiOperation({ summary: 'Tao moi bo de thi' })
  @ApiCreatedResponse({ type: ExamSetResponseDto })
  create(@Body() dto: CreateExamSetDto) {
    return this.examSetService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lay danh sach bo de thi' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'size', required: false, type: Number })
  @ApiQuery({
    name: 'classId',
    required: false,
    type: String,
    description: 'Loc theo ID lop hoc',
  })
  @ApiQuery({
    name: 'gradeId',
    required: false,
    type: String,
    description: 'Loc theo ID khoi',
  })
  @ApiQuery({
    name: 'subjectId',
    required: false,
    type: String,
    description: 'Loc theo ID mon hoc',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ExamSetStatus,
    description: 'Loc theo trang thai bo de',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Tim kiem theo ten hoac mo ta',
  })
  @ApiOkResponse({ type: ExamSetListResponseDto })
  findAll(
    @Query('page') page?: number,
    @Query('size') size?: number,
    @Query('classId') classId?: string,
    @Query('gradeId') gradeId?: string,
    @Query('subjectId') subjectId?: string,
    @Query('status') status?: ExamSetStatus,
    @Query('search') search?: string,
  ): Promise<PaginationResponseDto<ExamSetResponseDto>> {
    return this.examSetService.findAll(
      page,
      size,
      classId,
      gradeId,
      subjectId,
      status,
      search,
    );
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Lay thong tin bo de thi theo ID' })
  @ApiOkResponse({ type: ExamSetDetailResponseDto })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.examSetService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cap nhat thong tin bo de thi' })
  @ApiOkResponse({ type: ExamSetResponseDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateExamSetDto,
  ) {
    return this.examSetService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xoa bo de thi' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.examSetService.remove(id);
  }
}
