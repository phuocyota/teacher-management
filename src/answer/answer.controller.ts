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
import { AnswerService } from './answer.service';
import { CreateAnswerDto, UpdateAnswerDto } from './dto/create-answer.dto';
import { AnswerListResponseDto, AnswerResponseDto } from './dto/answer.dto';
import { PaginationResponseDto } from 'src/common/dto/pagination.dto';

@ApiTags('Answer')
@ApiBearerAuth('access-token')
@Controller('answer')
export class AnswerController {
  constructor(private readonly answerService: AnswerService) {}

  @Post()
  @ApiOperation({ summary: 'Tạo mới câu trả lời' })
  @ApiCreatedResponse({ type: AnswerResponseDto })
  create(@Body() dto: CreateAnswerDto) {
    return this.answerService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách câu trả lời' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'size', required: false, type: Number })
  @ApiQuery({
    name: 'questionId',
    required: false,
    type: String,
    description: 'Lọc theo questionId',
  })
  @ApiQuery({
    name: 'answerType',
    required: false,
    type: String,
    description: 'Lọc theo loại câu trả lời (TEXT, IMAGE hoặc AUDIO)',
  })
  @ApiOkResponse({ type: AnswerListResponseDto })
  findAll(
    @Query('page') page?: number,
    @Query('size') size?: number,
    @Query('questionId') questionId?: string,
    @Query('answerType') answerType?: string,
  ): Promise<PaginationResponseDto<AnswerResponseDto>> {
    return this.answerService.findAll(page, size, questionId, answerType);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy thông tin câu trả lời theo ID' })
  @ApiOkResponse({ type: AnswerResponseDto })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.answerService.findOne(id);
  }

  @Get(':id/chain')
  @ApiOperation({
    summary: 'Lấy câu trả lời với toàn bộ chuỗi nội dung (text/image xen kẽ)',
    description:
      'Trả về mảng các phần nội dung của câu trả lời theo thứ tự nextContent',
  })
  @ApiOkResponse({ type: [AnswerResponseDto] })
  getAnswerChain(@Param('id', ParseUUIDPipe) id: string) {
    return this.answerService.getAnswerWithChain(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật thông tin câu trả lời' })
  @ApiOkResponse({ type: AnswerResponseDto })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAnswerDto) {
    return this.answerService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa câu trả lời' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.answerService.remove(id);
  }
}
