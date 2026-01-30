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
import { QuestionBankService } from './question-bank.service';
import {
  CreateQuestionBankDto,
  UpdateQuestionBankDto,
} from './dto/create-question-bank.dto';
import {
  QuestionBankListResponseDto,
  QuestionBankResponseDto,
} from './dto/question-bank.dto';
import { PaginationResponseDto } from 'src/common/dto/pagination.dto';

@ApiTags('Question Bank')
@ApiBearerAuth('access-token')
@Controller('question-bank')
export class QuestionBankController {
  constructor(private readonly questionBankService: QuestionBankService) {}

  @Post()
  @ApiOperation({ summary: 'Tạo mới ngân hàng câu hỏi' })
  @ApiCreatedResponse({ type: QuestionBankResponseDto })
  create(@Body() dto: CreateQuestionBankDto) {
    return this.questionBankService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách ngân hàng câu hỏi' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'size', required: false, type: Number })
  @ApiQuery({
    name: 'classId',
    required: false,
    type: String,
    description: 'Filter by classId',
  })
  @ApiQuery({
    name: 'examDate',
    required: false,
    type: String,
    description: 'Filter by exam date (YYYY-MM-DD)',
  })
  @ApiOkResponse({ type: QuestionBankListResponseDto })
  findAll(
    @Query('page') page?: number,
    @Query('size') size?: number,
    @Query('classId') classId?: string,
    @Query('examDate') examDate?: string,
  ): Promise<PaginationResponseDto<QuestionBankResponseDto>> {
    return this.questionBankService.findAll(page, size, classId, examDate);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy thông tin ngân hàng câu hỏi theo ID' })
  @ApiOkResponse({ type: QuestionBankResponseDto })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.questionBankService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật thông tin ngân hàng câu hỏi' })
  @ApiOkResponse({ type: QuestionBankResponseDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateQuestionBankDto,
  ) {
    return this.questionBankService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa ngân hàng câu hỏi' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.questionBankService.remove(id);
  }
}
