import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { QuestionBankQuestionService } from './question-bank-question.service';
import {
  CreateQuestionBankQuestionDto,
  UpdateQuestionBankQuestionDto,
} from './dto/create-question-bank-question.dto';
import {
  QuestionBankQuestionListResponseDto,
  QuestionBankQuestionResponseDto,
} from './dto/question-bank-question.dto';
import { PaginationResponseDto } from 'src/common/dto/pagination.dto';

@ApiTags('Question Bank Question')
@ApiBearerAuth('access-token')
@Controller('question-bank-question')
export class QuestionBankQuestionController {
  constructor(
    private readonly questionBankQuestionService: QuestionBankQuestionService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Tạo liên kết ngân hàng câu hỏi với câu hỏi' })
  @ApiCreatedResponse({ type: QuestionBankQuestionResponseDto })
  create(@Body() dto: CreateQuestionBankQuestionDto) {
    return this.questionBankQuestionService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách liên kết ngân hàng câu hỏi' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'size', required: false, type: Number })
  @ApiQuery({
    name: 'questionBankId',
    required: false,
    type: String,
    description: 'Filter theo questionBankId',
  })
  @ApiQuery({
    name: 'questionId',
    required: false,
    type: String,
    description: 'Filter theo questionId',
  })
  @ApiOkResponse({ type: QuestionBankQuestionListResponseDto })
  findAll(
    @Query('page') page?: number,
    @Query('size') size?: number,
    @Query('questionBankId') questionBankId?: string,
    @Query('questionId') questionId?: string,
  ): Promise<PaginationResponseDto<QuestionBankQuestionResponseDto>> {
    return this.questionBankQuestionService.findAll(
      page,
      size,
      questionBankId,
      questionId,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy thông tin liên kết theo ID' })
  @ApiOkResponse({ type: QuestionBankQuestionResponseDto })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.questionBankQuestionService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật liên kết ngân hàng câu hỏi với câu hỏi' })
  @ApiOkResponse({ type: QuestionBankQuestionResponseDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateQuestionBankQuestionDto,
  ) {
    return this.questionBankQuestionService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa liên kết ngân hàng câu hỏi với câu hỏi' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.questionBankQuestionService.remove(id);
  }
}
