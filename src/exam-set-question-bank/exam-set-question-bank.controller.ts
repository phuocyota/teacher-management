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
import { ExamSetQuestionBankService } from './exam-set-question-bank.service';
import {
  CreateExamSetQuestionBankDto,
  UpdateExamSetQuestionBankDto,
} from './dto/create-exam-set-question-bank.dto';
import {
  ExamSetQuestionBankListResponseDto,
  ExamSetQuestionBankResponseDto,
} from './dto/exam-set-question-bank.dto';
import { PaginationResponseDto } from 'src/common/dto/pagination.dto';

@ApiTags('Exam Set Question Bank')
@ApiBearerAuth('access-token')
@Controller('exam-set-question-bank')
export class ExamSetQuestionBankController {
  constructor(
    private readonly examSetQuestionBankService: ExamSetQuestionBankService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Tao moi lien ket bo de thi va ngan hang cau hoi' })
  @ApiCreatedResponse({ type: ExamSetQuestionBankResponseDto })
  create(@Body() dto: CreateExamSetQuestionBankDto) {
    return this.examSetQuestionBankService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lay danh sach lien ket bo de thi va ngan hang cau hoi' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'size', required: false, type: Number })
  @ApiQuery({
    name: 'examSetId',
    required: false,
    type: String,
    description: 'Loc theo ID bo de thi',
  })
  @ApiQuery({
    name: 'questionBankId',
    required: false,
    type: String,
    description: 'Loc theo ID ngan hang cau hoi',
  })
  @ApiOkResponse({ type: ExamSetQuestionBankListResponseDto })
  findAll(
    @Query('page') page?: number,
    @Query('size') size?: number,
    @Query('examSetId') examSetId?: string,
    @Query('questionBankId') questionBankId?: string,
  ): Promise<PaginationResponseDto<ExamSetQuestionBankResponseDto>> {
    return this.examSetQuestionBankService.findAll(
      page,
      size,
      examSetId,
      questionBankId,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lay thong tin lien ket bo de thi va ngan hang cau hoi theo ID' })
  @ApiOkResponse({ type: ExamSetQuestionBankResponseDto })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.examSetQuestionBankService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cap nhat lien ket bo de thi va ngan hang cau hoi' })
  @ApiOkResponse({ type: ExamSetQuestionBankResponseDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateExamSetQuestionBankDto,
  ) {
    return this.examSetQuestionBankService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xoa lien ket bo de thi va ngan hang cau hoi' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.examSetQuestionBankService.remove(id);
  }
}
