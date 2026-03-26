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
import { QuestionService } from './question.service';
import {
  CreateQuestionDto,
  UpdateQuestionDto,
} from './dto/create-question.dto';
import {
  QuestionListResponseDto,
  QuestionResponseDto,
} from './dto/question.dto';
import { PaginationResponseDto } from 'src/common/dto/pagination.dto';
import { QuestionType } from './enum/question-type.enum';

@ApiTags('Question')
@ApiBearerAuth('access-token')
@Controller('question')
export class QuestionController {
  constructor(private readonly questionService: QuestionService) {}

  @Post()
  @ApiOperation({ summary: 'Tạo mới câu hỏi' })
  @ApiCreatedResponse({ type: QuestionResponseDto })
  create(@Body() dto: CreateQuestionDto) {
    return this.questionService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách câu hỏi' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'size', required: false, type: Number })
  @ApiQuery({
    name: 'questionBankId',
    required: false,
    type: String,
    description: 'Filter by questionBankId',
  })
  @ApiQuery({
    name: 'questionType',
    required: false,
    type: String,
    description: 'Filter by content type (TEXT, IMAGE, or AUDIO)',
  })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: QuestionType,
    description:
      'Filter by question type (SINGLE_CHOICE, MULTIPLE_CHOICE, or TEXT_INPUT)',
  })
  @ApiOkResponse({ type: QuestionListResponseDto })
  findAll(
    @Query('page') page?: number,
    @Query('size') size?: number,
    @Query('questionBankId') questionBankId?: string,
    @Query('questionType') questionType?: string,
    @Query('type') type?: QuestionType,
  ): Promise<PaginationResponseDto<QuestionResponseDto>> {
    return this.questionService.findAll(
      page,
      size,
      questionBankId,
      questionType,
      type,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy thông tin câu hỏi theo ID' })
  @ApiOkResponse({ type: QuestionResponseDto })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.questionService.findOne(id);
  }

  @Get(':id/chain')
  @ApiOperation({
    summary: 'Lấy câu hỏi với toàn bộ chuỗi nội dung (text/image xen kẽ)',
    description:
      'Trả về mảng các phần nội dung của câu hỏi theo thứ tự nextContent',
  })
  @ApiOkResponse({ type: [QuestionResponseDto] })
  getQuestionChain(@Param('id', ParseUUIDPipe) id: string) {
    return this.questionService.getQuestionWithChain(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật thông tin câu hỏi' })
  @ApiOkResponse({ type: QuestionResponseDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateQuestionDto,
  ) {
    return this.questionService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa câu hỏi' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.questionService.remove(id);
  }
}
