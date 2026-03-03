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
import { StudentAnswerService } from './student-answer.service';
import {
  CreateStudentAnswerDto,
  UpdateStudentAnswerDto,
} from './dto/create-student-answer.dto';
import {
  StudentAnswerListResponseDto,
  StudentAnswerResponseDto,
} from './dto/student-answer.dto';
import { PaginationResponseDto } from 'src/common/dto/pagination.dto';

@ApiTags('Student Answer')
@ApiBearerAuth('access-token')
@Controller('student-answer')
export class StudentAnswerController {
  constructor(private readonly studentAnswerService: StudentAnswerService) {}

  @Post()
  @ApiOperation({ summary: 'Tạo câu trả lời của học sinh' })
  @ApiCreatedResponse({ type: StudentAnswerResponseDto })
  create(@Body() dto: CreateStudentAnswerDto) {
    return this.studentAnswerService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách câu trả lời của học sinh' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'size', required: false, type: Number })
  @ApiQuery({
    name: 'attemptId',
    required: false,
    type: String,
    description: 'Filter theo attemptId',
  })
  @ApiQuery({
    name: 'questionId',
    required: false,
    type: String,
    description: 'Filter theo questionId',
  })
  @ApiQuery({
    name: 'answerId',
    required: false,
    type: String,
    description: 'Filter theo answerId',
  })
  @ApiOkResponse({ type: StudentAnswerListResponseDto })
  findAll(
    @Query('page') page?: number,
    @Query('size') size?: number,
    @Query('attemptId') attemptId?: string,
    @Query('questionId') questionId?: string,
    @Query('answerId') answerId?: string,
  ): Promise<PaginationResponseDto<StudentAnswerResponseDto>> {
    return this.studentAnswerService.findAll(
      page,
      size,
      attemptId,
      questionId,
      answerId,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy thông tin câu trả lời theo ID' })
  @ApiOkResponse({ type: StudentAnswerResponseDto })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.studentAnswerService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật câu trả lời của học sinh' })
  @ApiOkResponse({ type: StudentAnswerResponseDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStudentAnswerDto,
  ) {
    return this.studentAnswerService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa câu trả lời của học sinh' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.studentAnswerService.remove(id);
  }
}
