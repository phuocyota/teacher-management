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
  UseGuards,
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
import {
  AttemptExamHistoryItemDto,
  AttemptListResponseDto,
  AttemptResponseDto,
} from './dto/attempt.dto';
import { AttemptStatus } from './enum/attempt-status.enum';
import {
  EndAttemptDto,
  EndAttemptResponseDto,
  StartAttemptDto,
  StartAttemptResponseDto,
} from './dto/attempt-session.dto';
import { User } from 'src/common/decorator/user.decorator';
import type { JwtPayload } from 'src/common/interface/jwt-payload.interface';
import { RolesGuard } from 'src/common/guard/roles.guard';
import { Roles } from 'src/common/decorator/roles.decorator';
import { UserType } from 'src/common/enum/user-type.enum';

@ApiTags('Attempt')
@ApiBearerAuth('access-token')
@Controller('attempt')
export class AttemptController {
  constructor(private readonly attemptService: AttemptService) {}

  @Post()
  @ApiOperation({ summary: 'Create attempt manually' })
  @ApiCreatedResponse({ type: AttemptResponseDto })
  create(@Body() dto: CreateAttemptDto) {
    return this.attemptService.create(dto);
  }

  @Post('start')
  @UseGuards(RolesGuard)
  @Roles(UserType.STUDENT)
  @ApiOperation({ summary: 'Start attempt and return exam payload' })
  @ApiCreatedResponse({ type: StartAttemptResponseDto })
  start(@Body() dto: StartAttemptDto, @User() user: JwtPayload) {
    return this.attemptService.start(dto, user);
  }

  @Post(':id/end')
  @UseGuards(RolesGuard)
  @Roles(UserType.STUDENT)
  @ApiOperation({ summary: 'End attempt and record submitted answers' })
  @ApiOkResponse({ type: EndAttemptResponseDto })
  end(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EndAttemptDto,
    @User() user: JwtPayload,
  ) {
    return this.attemptService.end(id, dto, user);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserType.STUDENT)
  @ApiOperation({ summary: 'List attempts' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'size', required: false, type: Number })
  @ApiQuery({ name: 'questionBankId', required: false, type: String })
  @ApiQuery({ name: 'examSetId', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: AttemptStatus })
  @ApiOkResponse({ type: AttemptListResponseDto })
  findAll(
    @User() user: JwtPayload,
    @Query('page') page?: number,
    @Query('size') size?: number,
    @Query('questionBankId') questionBankId?: string,
    @Query('examSetId') examSetId?: string,
    @Query('status') status?: AttemptStatus,
  ): Promise<PaginationResponseDto<AttemptResponseDto>> {
    return this.attemptService.findAll(
      user,
      page,
      size,
      questionBankId,
      examSetId,
      status,
    );
  }

  @Get('exam-history')
  @UseGuards(RolesGuard)
  @Roles(UserType.STUDENT)
  @ApiOperation({
    summary:
      'List exam history grouped by date and exam name for current student',
  })
  @ApiQuery({
    name: 'fromDate',
    required: false,
    type: String,
    description: 'Filter from date (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'toDate',
    required: false,
    type: String,
    description: 'Filter to date (YYYY-MM-DD)',
  })
  @ApiOkResponse({ type: [AttemptExamHistoryItemDto] })
  findExamHistory(
    @User() user: JwtPayload,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ): Promise<AttemptExamHistoryItemDto[]> {
    return this.attemptService.findExamHistory(user, fromDate, toDate);
  }

  @Get('exam-history/detail')
  @UseGuards(RolesGuard)
  @Roles(UserType.STUDENT)
  @ApiOperation({
    summary:
      'List attempt details for a grouped exam history record of current student',
  })
  @ApiQuery({
    name: 'date',
    required: true,
    type: String,
    description: 'Attempt date (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'questionBankId',
    required: true,
    type: String,
    description: 'Question bank ID',
  })
  @ApiOkResponse({ type: [AttemptResponseDto] })
  findExamHistoryDetail(
    @User() user: JwtPayload,
    @Query('date') date: string,
    @Query('questionBankId') questionBankId: string,
  ): Promise<AttemptResponseDto[]> {
    return this.attemptService.findExamHistoryDetail(
      user,
      date,
      questionBankId,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get attempt by id' })
  @ApiOkResponse({ type: AttemptResponseDto })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.attemptService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update attempt' })
  @ApiOkResponse({ type: AttemptResponseDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAttemptDto,
  ) {
    return this.attemptService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete attempt' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.attemptService.remove(id);
  }
}
