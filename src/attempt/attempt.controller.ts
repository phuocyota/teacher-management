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
import { AttemptService } from './attempt.service';
import { CreateAttemptDto, UpdateAttemptDto } from './dto/create-attempt.dto';
import { PaginationResponseDto } from 'src/common/dto/pagination.dto';
import { AttemptListResponseDto, AttemptResponseDto } from './dto/attempt.dto';
import { AttemptStatus } from './enum/attempt-status.enum';

@ApiTags('Attempt')
@ApiBearerAuth('access-token')
@Controller('attempt')
export class AttemptController {
  constructor(private readonly attemptService: AttemptService) {}

  @Post()
  @ApiOperation({ summary: 'Tạo mới bài làm' })
  @ApiCreatedResponse({ type: AttemptResponseDto })
  create(@Body() dto: CreateAttemptDto) {
    return this.attemptService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách bài làm' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'size', required: false, type: Number })
  @ApiQuery({
    name: 'studentId',
    required: false,
    type: String,
    description: 'Filter theo studentId',
  })
  @ApiQuery({
    name: 'questionBankId',
    required: false,
    type: String,
    description: 'Filter theo questionBankId',
  })
  @ApiQuery({
    name: 'examSetId',
    required: false,
    type: String,
    description: 'Filter theo examSetId',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: AttemptStatus,
    description: 'Filter theo trạng thái bài làm',
  })
  @ApiOkResponse({ type: AttemptListResponseDto })
  findAll(
    @Query('page') page?: number,
    @Query('size') size?: number,
    @Query('studentId') studentId?: string,
    @Query('questionBankId') questionBankId?: string,
    @Query('examSetId') examSetId?: string,
    @Query('status') status?: AttemptStatus,
  ): Promise<PaginationResponseDto<AttemptResponseDto>> {
    return this.attemptService.findAll(
      page,
      size,
      studentId,
      questionBankId,
      examSetId,
      status,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy thông tin bài làm theo ID' })
  @ApiOkResponse({ type: AttemptResponseDto })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.attemptService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật bài làm' })
  @ApiOkResponse({ type: AttemptResponseDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAttemptDto,
  ) {
    return this.attemptService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa bài làm' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.attemptService.remove(id);
  }
}
