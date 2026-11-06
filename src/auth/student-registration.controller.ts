import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseInterceptors,
  ValidationPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import {
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from 'src/common/decorator/public.decorator';
import { RegisterStudentDto } from './dto/register-student.dto';
import { StudentRegistrationService } from './student-registration.service';
import { RegistrationSchoolsDto } from './dto/registration-schools.dto';

@ApiTags('Student registration')
@Public()
@Controller('auth/register/student')
export class StudentRegistrationController {
  constructor(private readonly registration: StudentRegistrationService) {}

  @Get('zones/HCM/schools')
  @ApiOkResponse({ type: RegistrationSchoolsDto })
  @ApiOperation({
    summary: 'Lấy trường và lớp thuộc zone có mã HCM, không cần đăng nhập',
  })
  hcmSchoolsAndClasses() {
    return this.registration.hcmSchoolsAndClasses();
  }

  @Get('schools')
  @ApiOperation({
    summary: 'Danh sách trường cho đăng ký học sinh (chỉ ID và tên)',
  })
  schools() {
    return this.registration.schools();
  }

  @Get('schools/:schoolId/classes')
  classes(@Param('schoolId', ParseUUIDPipe) schoolId: string) {
    return this.registration.classes(schoolId);
  }

  @Post()
  @ApiOperation({
    summary: 'Đăng ký tài khoản STUDENT, hồ sơ, lớp và ảnh trong một thao tác',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['password', 'fullName', 'photo'],
      allOf: [
        { anyOf: [{ required: ['schoolId'] }, { required: ['schoolName'] }] },
        { anyOf: [{ required: ['classId'] }, { required: ['className'] }] },
      ],
      properties: {
        password: { type: 'string', minLength: 6, maxLength: 72 },
        fullName: { type: 'string' },
        schoolId: { type: 'string', format: 'uuid' },
        classId: { type: 'string', format: 'uuid' },
        schoolName: {
          type: 'string',
          maxLength: 255,
          description:
            'Tìm hoặc tạo trường trong khu vực HCM nếu không gửi schoolId',
        },
        className: {
          type: 'string',
          maxLength: 255,
          description:
            'Tìm hoặc tạo lớp thuộc trường đã xác định nếu không gửi classId',
        },
        phoneNumber: { type: 'string' },
        photo: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: memoryStorage(),
      limits: {
        fileSize: 5 * 1024 * 1024,
        files: 1,
        fields: 8,
        fieldSize: 1024,
      },
    }),
  )
  register(
    @Body(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    )
    dto: RegisterStudentDto,
    @UploadedFile() photo?: { buffer: Buffer },
  ) {
    return this.registration.register(dto, photo);
  }
}
