import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Res,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { Roles } from 'src/common/decorator/roles.decorator';
import { User } from 'src/common/decorator/user.decorator';
import { UserType } from 'src/common/enum/user-type.enum';
import { RolesGuard } from 'src/common/guard/roles.guard';
import type { JwtPayload } from 'src/common/interface/jwt-payload.interface';
import {
  AttemptReportFilterQueryDto,
  ClassAttemptScoresExportQueryDto,
  ReportStudentOptionDto,
  StudentBestAttemptDetailExportQueryDto,
  StudentReportDto,
  StudentReportQueryDto,
  TeacherLeaderGroupDto,
} from './dto/report.dto';
import { ReportService } from './report.service';

@ApiTags('Attempt Report')
@ApiBearerAuth('access-token')
@Controller('report/attempt')
@UseGuards(RolesGuard)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
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
  @Roles(UserType.ADMIN, UserType.TEACHER)
  @ApiOperation({
    summary:
      'Lay bao cao hoc sinh theo nhom hoc sinh va khoang thoi gian, gom tong quan, xu huong diem va lich su lam bai',
  })
  @ApiOkResponse({ type: StudentReportDto })
  getStudentReport(
    @User() user: JwtPayload,
    @Query() query: StudentReportQueryDto,
  ): Promise<StudentReportDto> {
    return this.reportService.getStudentReport(user, {
      zoneId: query.zoneId,
      schoolId: query.schoolId,
      groupId: query.groupId ?? query.studentGroupId,
      studentId: query.studentId,
      fromDate: query.fromDate,
      toDate: query.toDate,
      page: query.page,
      limit: query.limit,
    });
  }

  @Get('schools/:schoolId/export-pdf')
  @Roles(UserType.ADMIN, UserType.TEACHER)
  @ApiOperation({
    summary:
      'Xuat file PDF bao cao diem tong hop cua tat ca lop trong mot truong',
  })
  @ApiProduces('application/pdf')
  async exportSchoolAttemptReportPdf(
    @User() user: JwtPayload,
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @Query() query: AttemptReportFilterQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const file = await this.reportService.exportSchoolAttemptReportPdf(
      user,
      schoolId,
      query,
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
    summary: 'Xuat file Excel danh sach diem bai thi cua mot hoac nhieu lop',
  })
  @ApiProduces(
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  async exportClassAttemptScoresExcel(
    @User() user: JwtPayload,
    @Query() query: ClassAttemptScoresExportQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const file = await this.reportService.exportClassAttemptScoresExcel(
      user,
      query.groupIds,
      query,
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

  @Get('student/export-detail')
  @Roles(UserType.ADMIN, UserType.TEACHER, UserType.STUDENT)
  @ApiOperation({
    summary:
      'Xuat sheet CHI TIET HS theo userId va questionBankId, lay lan lam bai co diem cao nhat',
  })
  @ApiProduces(
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  async exportCurrentStudentBestAttemptDetailExcel(
    @User() user: JwtPayload,
    @Query() query: StudentBestAttemptDetailExportQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const file =
      await this.reportService.exportCurrentStudentBestAttemptDetailExcel(
        user,
        query.userId,
        query.questionBankId,
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
  async exportGroupResultSheetExcel(
    @User() user: JwtPayload,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Query() query: AttemptReportFilterQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const file = await this.reportService.exportGroupResultSheetExcel(
      user,
      groupId,
      query,
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
  async exportSchoolStatSheetExcel(
    @User() user: JwtPayload,
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @Query() query: AttemptReportFilterQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const file = await this.reportService.exportSchoolStatSheetExcel(
      user,
      schoolId,
      query,
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

  @Get('zones/:zoneId/export-zone-stat-sheet')
  @Roles(UserType.ADMIN, UserType.TEACHER)
  @ApiOperation({
    summary: 'Xuat sheet THONG KE KHU VUC cho mot khu vuc',
  })
  @ApiProduces(
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  async exportZoneStatSheetExcel(
    @User() user: JwtPayload,
    @Param('zoneId', ParseUUIDPipe) zoneId: string,
    @Query() query: AttemptReportFilterQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const file = await this.reportService.exportZoneStatSheetExcel(
      user,
      zoneId,
      query,
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
