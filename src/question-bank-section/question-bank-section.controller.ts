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
import {
  CreateQuestionBankSectionDto,
  QuestionBankSectionResponseDto,
  UpdateQuestionBankSectionDto,
} from './dto/question-bank-section.dto';
import { QuestionBankSectionService } from './question-bank-section.service';

@ApiTags('Question Bank Section')
@ApiBearerAuth('access-token')
@Controller('question-bank-section')
export class QuestionBankSectionController {
  constructor(private readonly sectionService: QuestionBankSectionService) {}

  @Post()
  @ApiOperation({ summary: 'Tạo phần trong ngân hàng câu hỏi' })
  @ApiCreatedResponse({ type: QuestionBankSectionResponseDto })
  create(@Body() dto: CreateQuestionBankSectionDto) {
    return this.sectionService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách phần theo ngân hàng câu hỏi' })
  @ApiQuery({ name: 'questionBankId', type: String })
  @ApiOkResponse({ type: [QuestionBankSectionResponseDto] })
  findAll(@Query('questionBankId', ParseUUIDPipe) questionBankId: string) {
    return this.sectionService.findAll(questionBankId);
  }

  @Get(':id')
  @ApiOkResponse({ type: QuestionBankSectionResponseDto })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.sectionService.findOne(id);
  }

  @Patch(':id')
  @ApiOkResponse({ type: QuestionBankSectionResponseDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateQuestionBankSectionDto,
  ) {
    return this.sectionService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.sectionService.remove(id);
  }
}
