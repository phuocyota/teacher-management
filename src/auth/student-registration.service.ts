import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, ILike, In, QueryFailedError } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import bcrypt from 'bcryptjs';
import sharp from 'sharp';
import { UserEntity } from 'src/user/user.entity';
import { StudentEntity } from 'src/student/student.entity';
import { SchoolEntity } from 'src/school/school.entity';
import { StudentGroupEntity } from 'src/student-group/student-group.entity';
import { StudentGroupMemberEntity } from 'src/student-group/student-group-member.entity';
import { UserType } from 'src/common/enum/user-type.enum';
import { Status } from 'src/user/enum/status.enum';
import { RegisterStudentDto } from './dto/register-student.dto';
import { AuthService } from './auth.service';
import { ZoneEntity } from 'src/zone/zone.entity';

@Injectable()
export class StudentRegistrationService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly auth: AuthService,
  ) {}

  schools() {
    return this.dataSource
      .getRepository(SchoolEntity)
      .find({ select: { id: true, name: true }, order: { name: 'ASC' } });
  }

  async hcmSchoolsAndClasses() {
    const zone = await this.dataSource.getRepository(ZoneEntity).findOne({
      where: { code: ILike('HCM') },
      select: { id: true, code: true, name: true },
    });
    if (!zone) throw new NotFoundException('Không tìm thấy khu vực có mã HCM.');
    const schools = await this.dataSource.getRepository(SchoolEntity).find({
      where: { zoneId: zone.id },
      select: { id: true, name: true },
      order: { name: 'ASC' },
    });
    const classes = schools.length
      ? await this.dataSource.getRepository(StudentGroupEntity).find({
          where: { schoolId: In(schools.map((school) => school.id)) },
          select: { id: true, name: true, schoolId: true },
          order: { name: 'ASC' },
        })
      : [];
    const classesBySchool = new Map<string, { id: string; name: string }[]>();
    for (const group of classes) {
      const list = classesBySchool.get(group.schoolId) || [];
      list.push({ id: group.id, name: group.name });
      classesBySchool.set(group.schoolId, list);
    }
    return {
      zone: { id: zone.id, code: zone.code, name: zone.name },
      schools: schools.map((school) => ({
        id: school.id,
        name: school.name,
        classes: classesBySchool.get(school.id) || [],
      })),
    };
  }

  classes(schoolId: string) {
    return this.dataSource.getRepository(StudentGroupEntity).find({
      where: { schoolId },
      select: { id: true, name: true },
      order: { name: 'ASC' },
    });
  }

  async register(dto: RegisterStudentDto, photo?: { buffer: Buffer }) {
    if (!photo?.buffer?.length)
      throw new BadRequestException('Vui lòng chụp ảnh học sinh.');
    if (Buffer.byteLength(dto.password, 'utf8') > 72)
      throw new BadRequestException('Mật khẩu không được vượt quá 72 byte.');
    let image: Buffer;
    try {
      image = await sharp(photo.buffer, {
        limitInputPixels: 16000000,
        animated: false,
      })
        .rotate()
        .resize(640, 640, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();
    } catch {
      throw new BadRequestException('Ảnh không hợp lệ. Vui lòng chụp lại.');
    }
    const hashPassword = await bcrypt.hash(dto.password, 10);
    const filename = `${randomUUID()}.jpg`;
    const directory = resolve(
      process.env.UPLOAD_DIR || 'uploads',
      'student-registration',
    );
    const filePath = join(directory, filename);
    let fileWritten = false;
    try {
      return await this.dataSource.transaction(async (manager) => {
        // Serialize case-insensitive username checks across concurrent registrations.
        await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
          `student-register:${dto.userName.toLowerCase()}`,
        ]);
        const existing = await manager
          .getRepository(UserEntity)
          .createQueryBuilder('user')
          .where(
            'LOWER(user.userName) = LOWER(:name) OR LOWER(user.email) = LOWER(:name)',
            { name: dto.userName },
          )
          .getOne();
        if (existing)
          throw new ConflictException('ID đăng nhập đã được sử dụng.');
        const existingStudent = await manager
          .getRepository(StudentEntity)
          .createQueryBuilder('student')
          .where('LOWER(student.code) = LOWER(:code)', { code: dto.userName })
          .getOne();
        if (existingStudent)
          throw new ConflictException('Mã học sinh đã được sử dụng.');
        const school = await manager.findOneBy(SchoolEntity, {
          id: dto.schoolId,
        });
        if (!school) throw new NotFoundException('Trường học không tồn tại.');
        const group = await manager.findOneBy(StudentGroupEntity, {
          id: dto.classId,
          schoolId: school.id,
        });
        if (!group)
          throw new BadRequestException('Lớp học không thuộc trường đã chọn.');
        await mkdir(directory, { recursive: true });
        await writeFile(filePath, image, { flag: 'wx' });
        fileWritten = true;
        const avatar = `/uploads/student-registration/${filename}`;
        const user = await manager.save(
          UserEntity,
          manager.create(UserEntity, {
            userName: dto.userName,
            hashPassword,
            fullName: dto.fullName,
            phoneNumber: dto.phoneNumber,
            avatar,
            userType: UserType.STUDENT,
            status: Status.ACTIVE,
          }),
        );
        const student = await manager.save(
          StudentEntity,
          manager.create(StudentEntity, {
            id: user.id,
            code: dto.userName,
            fullName: dto.fullName,
            image: avatar,
            phone: dto.phoneNumber || null,
            schoolId: school.id,
            studentGroupId: group.id,
          }),
        );
        await manager.save(
          StudentGroupMemberEntity,
          manager.create(StudentGroupMemberEntity, {
            userId: user.id,
            studentGroupId: group.id,
          }),
        );
        const session = await this.auth.createStudentRegistrationSession(
          user,
          manager,
        );
        return {
          ...session,
          studentId: student.id,
          userName: user.userName,
          fullName: user.fullName,
          avatar,
          schoolName: school.name,
          className: group.name,
        };
      });
    } catch (error) {
      if (fileWritten) await unlink(filePath).catch(() => undefined);
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string }).code === '23505'
      )
        throw new ConflictException('ID đăng nhập đã được sử dụng.');
      throw error;
    }
  }
}
