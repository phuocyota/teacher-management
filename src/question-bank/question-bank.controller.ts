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
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiBearerAuth,
  ApiQuery,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiOperation,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { QuestionBankService } from './services/question-bank.service';
import {
  CreateQuestionBankDto,
  UpdateQuestionBankDto,
} from './dto/create-question-bank.dto';
import { AddQuestionToQuestionBankDto } from './dto/add-question-to-question-bank.dto';
import {
  QuestionBankListResponseDto,
  QuestionBankResponseDto,
} from './dto/question-bank.dto';
import { PaginationResponseDto } from 'src/common/dto/pagination.dto';
import { ImportExamResultDto } from './dto/import-exam.dto';
import { QuestionBankQuestionResponseDto } from 'src/question-bank-question/dto/question-bank-question.dto';
import { QuestionResponseDto } from 'src/question/dto/question.dto';
import { Public } from 'src/common/decorator/public.decorator';

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

  @Post(':id/questions')
  @ApiOperation({ summary: 'Thêm câu hỏi vào ngân hàng câu hỏi' })
  @ApiCreatedResponse({ type: QuestionBankQuestionResponseDto })
  addQuestion(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddQuestionToQuestionBankDto,
  ) {
    return this.questionBankService.addQuestion(id, dto);
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

  @Get('max-code')
  @ApiOperation({ summary: 'Lấy code lớn nhất của ngân hàng câu hỏi' })
  @ApiOkResponse({
    schema: { type: 'object', properties: { maxCode: { type: 'number' } } },
  })
  async getMaxCode(): Promise<{ maxCode: number }> {
    const maxCode = await this.questionBankService.getMaxCode();
    return { maxCode };
  }

  @Get('random/:questionBankId')
  @Public()
  @ApiOperation({
    summary: 'Lay ngau nhien 1 cau hoi trong ngan hang cau hoi',
    description:
      'Dung excludeQuestionIds de tranh lay lai cac cau hoi da hien thi, vi du: ?excludeQuestionIds=id1,id2',
  })
  @ApiQuery({
    name: 'excludeQuestionIds',
    required: false,
    type: String,
    description: 'Danh sach questionId can loai tru, phan cach bang dau phay',
  })
  @ApiOkResponse({ type: QuestionResponseDto })
  findRandomQuestion(
    @Param('questionBankId', ParseUUIDPipe) questionBankId: string,
    @Query('excludeQuestionIds') excludeQuestionIds?: string,
  ) {
    return this.questionBankService.findRandomQuestion(
      questionBankId,
      this.parseQuestionIds(excludeQuestionIds),
    );
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

  @Delete(':id/resource')
  @ApiOperation({
    summary: 'Xóa toàn bộ câu hỏi và đáp án của ngân hàng câu hỏi',
  })
  removeResource(@Param('id', ParseUUIDPipe) id: string) {
    return this.questionBankService.removeResource(id);
  }

  @Post(':id/import-pdf')
  @ApiOperation({ summary: 'Import đề thi từ file PDF' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'File PDF chứa đề thi',
        },
      },
      required: ['file'],
    },
  })
  @ApiOkResponse({ type: ImportExamResultDto })
  @UseInterceptors(FileInterceptor('file'))
  async importPdf(
    @Param('id', ParseUUIDPipe) questionBankId: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<ImportExamResultDto> {
    if (!file) {
      throw new Error('No file uploaded');
    }
    return this.questionBankService.importExamFromPdf(
      questionBankId,
      file.buffer,
    );
  }

  private parseQuestionIds(value?: string): string[] {
    if (!value) {
      return [];
    }

    const ids = value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    const invalidId = ids.find(
      (id) =>
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          id,
        ),
    );

    if (invalidId) {
      throw new BadRequestException(
        `excludeQuestionIds contains invalid UUID: ${invalidId}`,
      );
    }

    return [...new Set(ids)];
  }
}
