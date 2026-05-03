import {
  BadRequestException,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { Roles } from 'src/common/decorator/roles.decorator';
import { User } from 'src/common/decorator/user.decorator';
import { UserType } from 'src/common/enum/user-type.enum';
import { RolesGuard } from 'src/common/guard/roles.guard';
import type { JwtPayload } from 'src/common/interface/jwt-payload.interface';
import {
  ReportStudentOptionDto,
  StudentReportDto,
  TeacherLeaderGroupDto,
} from './dto/report.dto';
import { ReportService } from './report.service';

@ApiTags('Attempt Report')
@ApiBearerAuth('access-token')
@Controller('report/attempt')
@UseGuards(RolesGuard)
@Roles(UserType.TEACHER)
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Get('groups')
  @ApiOperation({
    summary: 'Lay danh sach nhom hoc sinh de chon tren man bao cao',
  })
  @ApiOkResponse({ type: [TeacherLeaderGroupDto] })
  getLeaderGroups(@User() user: JwtPayload): Promise<TeacherLeaderGroupDto[]> {
    return this.reportService.getLeaderGroups(user);
  }

  @Get('groups/:groupId/students')
  @ApiOperation({
    summary: 'Lay danh sach hoc sinh thuoc nhom hoc sinh da chon',
  })
  @ApiOkResponse({ type: [ReportStudentOptionDto] })
  getGroupStudents(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @User() user: JwtPayload,
  ): Promise<ReportStudentOptionDto[]> {
    return this.reportService.getGroupStudents(groupId, user);
  }

  @Get('student')
  @ApiOperation({
    summary:
      'Lay bao cao hoc sinh theo nhom hoc sinh va khoang thoi gian, gom tong quan, xu huong diem va lich su lam bai',
  })
  @ApiQuery({
    name: 'groupId',
    required: true,
    type: String,
    description: 'ID nhom hoc sinh (student_group.id)',
  })
  @ApiQuery({
    name: 'studentId',
    required: true,
    type: String,
    description: 'ID hoc sinh thuoc group',
  })
  @ApiQuery({
    name: 'fromDate',
    required: false,
    type: String,
    description: 'Ngay bat dau loc (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'toDate',
    required: false,
    type: String,
    description: 'Ngay ket thuc loc (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Trang lich su attempt',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'So dong moi trang',
  })
  @ApiOkResponse({ type: StudentReportDto })
  getStudentReport(
    @User() user: JwtPayload,
    @Query('groupId', ParseUUIDPipe) groupId: string,
    @Query('studentId', ParseUUIDPipe) studentId: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit?: number,
  ): Promise<StudentReportDto> {
    if (page && page < 1) {
      throw new BadRequestException('page phai lon hon hoac bang 1');
    }

    if (limit && limit < 1) {
      throw new BadRequestException('limit phai lon hon hoac bang 1');
    }

    return this.reportService.getStudentReport(
      user,
      groupId,
      studentId,
      fromDate,
      toDate,
      page,
      limit,
    );
  }

  @Get('schools/:schoolId/export-pdf')
  @Roles(UserType.ADMIN, UserType.TEACHER)
  @ApiOperation({
    summary:
      'Xuat file PDF bao cao diem tong hop cua tat ca lop trong mot truong',
  })
  @ApiProduces('application/pdf')
  @ApiQuery({
    name: 'examSetId',
    required: false,
    type: String,
    description: 'Loc theo bo de',
  })
  @ApiQuery({
    name: 'questionBankId',
    required: false,
    type: String,
    description: 'Loc theo de thi/ngan hang cau hoi',
  })
  @ApiQuery({
    name: 'fromDate',
    required: false,
    type: String,
    description: 'Ngay bat dau loc attempt (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'toDate',
    required: false,
    type: String,
    description: 'Ngay ket thuc loc attempt (YYYY-MM-DD)',
  })
  async exportSchoolAttemptReportPdf(
    @User() user: JwtPayload,
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @Query('examSetId') examSetId: string | undefined,
    @Query('questionBankId') questionBankId: string | undefined,
    @Query('fromDate') fromDate: string | undefined,
    @Query('toDate') toDate: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const file = await this.reportService.exportSchoolAttemptReportPdf(
      user,
      schoolId,
      {
        examSetId,
        questionBankId,
        fromDate,
        toDate,
      },
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.fileName}"`,
    );
    res.send(file.buffer);
  }

  @Get('classes/export-excel')
  @Roles(UserType.ADMIN, UserType.TEACHER)
  @ApiOperation({
    summary:
      'Xuat file Excel danh sach diem bai thi cua mot hoac nhieu lop',
  })
  @ApiProduces(
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  @ApiQuery({
    name: 'groupIds',
    required: true,
    type: String,
    description:
      'Danh sach ID lop/student_group, cach nhau boi dau phay. Moi lop la mot sheet.',
  })
  @ApiQuery({
    name: 'examSetId',
    required: false,
    type: String,
    description: 'Loc theo bo de',
  })
  @ApiQuery({
    name: 'questionBankId',
    required: false,
    type: String,
    description: 'Loc theo de thi/ngan hang cau hoi',
  })
  @ApiQuery({
    name: 'fromDate',
    required: false,
    type: String,
    description: 'Ngay bat dau loc attempt (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'toDate',
    required: false,
    type: String,
    description: 'Ngay ket thuc loc attempt (YYYY-MM-DD)',
  })
  async exportClassAttemptScoresExcel(
    @User() user: JwtPayload,
    @Query('groupIds') groupIds: string,
    @Query('examSetId') examSetId: string | undefined,
    @Query('questionBankId') questionBankId: string | undefined,
    @Query('fromDate') fromDate: string | undefined,
    @Query('toDate') toDate: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const file = await this.reportService.exportClassAttemptScoresExcel(
      user,
      groupIds?.split(',') ?? [],
      {
        examSetId,
        questionBankId,
        fromDate,
        toDate,
      },
    );

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.fileName}"`,
    );
    res.send(file.buffer);
  }

  @Get('attempts/:attemptId/export-student-sheet')
  @Roles(UserType.ADMIN, UserType.TEACHER)
  @ApiOperation({
    summary: 'Xuat sheet CHI TIET HS cho mot lan lam bai',
  })
  @ApiProduces(
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  async exportStudentAttemptDetailExcel(
    @User() user: JwtPayload,
    @Param('attemptId', ParseUUIDPipe) attemptId: string,
    @Res() res: Response,
  ): Promise<void> {
    const file = await this.reportService.exportStudentAttemptDetailExcel(
      user,
      attemptId,
    );

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.fileName}"`,
    );
    res.send(file.buffer);
  }

  @Get('groups/:groupId/export-class-sheet')
  @Roles(UserType.ADMIN, UserType.TEACHER)
  @ApiOperation({
    summary: 'Xuat sheet KET QUA LOP cho mot lop hoc sinh',
  })
  @ApiProduces(
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  @ApiQuery({
    name: 'examSetId',
    required: false,
    type: String,
    description: 'Loc theo bo de',
  })
  @ApiQuery({
    name: 'questionBankId',
    required: false,
    type: String,
    description: 'Loc theo de thi/ngan hang cau hoi',
  })
  @ApiQuery({
    name: 'fromDate',
    required: false,
    type: String,
    description: 'Ngay bat dau loc attempt (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'toDate',
    required: false,
    type: String,
    description: 'Ngay ket thuc loc attempt (YYYY-MM-DD)',
  })
  async exportGroupResultSheetExcel(
    @User() user: JwtPayload,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Query('examSetId') examSetId: string | undefined,
    @Query('questionBankId') questionBankId: string | undefined,
    @Query('fromDate') fromDate: string | undefined,
    @Query('toDate') toDate: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const file = await this.reportService.exportGroupResultSheetExcel(
      user,
      groupId,
      {
        examSetId,
        questionBankId,
        fromDate,
        toDate,
      },
    );

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.fileName}"`,
    );
    res.send(file.buffer);
  }

  @Get('schools/:schoolId/export-school-stat-sheet')
  @Roles(UserType.ADMIN, UserType.TEACHER)
  @ApiOperation({
    summary: 'Xuat sheet THONG KE TRUONG.KHU VUC cho mot truong',
  })
  @ApiProduces(
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  @ApiQuery({
    name: 'examSetId',
    required: false,
    type: String,
    description: 'Loc theo bo de',
  })
  @ApiQuery({
    name: 'questionBankId',
    required: false,
    type: String,
    description: 'Loc theo de thi/ngan hang cau hoi',
  })
  @ApiQuery({
    name: 'fromDate',
    required: false,
    type: String,
    description: 'Ngay bat dau loc attempt (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'toDate',
    required: false,
    type: String,
    description: 'Ngay ket thuc loc attempt (YYYY-MM-DD)',
  })
  async exportSchoolStatSheetExcel(
    @User() user: JwtPayload,
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @Query('examSetId') examSetId: string | undefined,
    @Query('questionBankId') questionBankId: string | undefined,
    @Query('fromDate') fromDate: string | undefined,
    @Query('toDate') toDate: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const file = await this.reportService.exportSchoolStatSheetExcel(
      user,
      schoolId,
      {
        examSetId,
        questionBankId,
        fromDate,
        toDate,
      },
    );

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.fileName}"`,
    );
    res.send(file.buffer);
  }
}
