import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DataSource,
  EntityManager,
  FindOptionsWhere,
  ILike,
  In,
  QueryFailedError,
} from 'typeorm';
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

  private normalizeName(value: string) {
    return value.normalize('NFC').trim().replace(/\s+/g, ' ');
  }

  private normalizeLoginName(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[đĐ]/g, 'D')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, ' ')
      .trim();
  }

  private abbreviateSchool(value: string): string {
    const name = this.normalizeLoginName(value)
      .replace(/^(?:TRUONG(?:\s+|$))+/, '')
      .replace(/\bTRUNG HOC PHO THONG\b/g, 'THPT')
      .replace(/\bTRUNG HOC CO SO\b/g, 'THCS')
      .replace(/\bTIEU HOC\b/g, 'TH')
      .replace(/\bMAM NON\b/g, 'MN')
      .replace(/\bMAU GIAO\b/g, 'MG');
    const schoolTypes = new Set(['TH', 'THCS', 'THPT', 'MN', 'MG']);
    return name
      .split(/\s+/)
      .map((word) =>
        schoolTypes.has(word) || /[0-9]/.test(word) ? word : word.charAt(0),
      )
      .join('');
  }

  private abbreviateClass(value: string): string {
    const name = this.normalizeLoginName(value).replace(/^LOP(?:\s+|$)/, '');
    // Standard class codes retain every letter/digit: "Lớp 5 A1" => "5A1".
    if (/^[0-9]/.test(name)) return name.replace(/\s+/g, '');
    return name
      .split(/\s+/)
      .map((word) => (/[0-9]/.test(word) ? word : word.charAt(0)))
      .join('');
  }

  private async allocateUserName(
    manager: EntityManager,
    school: string,
    className: string,
  ) {
    const schoolPrefix = this.abbreviateSchool(school);
    const classPrefix = this.abbreviateClass(className);
    const prefix = schoolPrefix + classPrefix;
    if (!schoolPrefix || !classPrefix || prefix.length > 40) {
      throw new BadRequestException(
        'Tên trường/lớp không phù hợp để sinh ID đăng nhập.',
      );
    }
    // A global allocation lock also covers overlapping numeric prefixes, e.g.
    // class "5" vs "50". Per-prefix locks alone cannot prevent those collisions.
    await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      'student-register:username-allocation',
    ]);
    const rows: { lastNumber: string }[] = await manager.query(
      `SELECT COALESCE(MAX(substring(name from $1)::numeric), 0)::text AS "lastNumber"
       FROM (
         SELECT UPPER(user_name) AS name FROM "user"
         UNION ALL SELECT UPPER(code) FROM student
         UNION ALL SELECT UPPER(email) FROM "user" WHERE email IS NOT NULL
       ) names WHERE name ~ $1`,
      [`^${prefix}([0-9]+)$`],
    );
    const next = Number(rows[0]?.lastNumber || 0) + 1;
    if (!Number.isSafeInteger(next)) {
      throw new ConflictException(
        'Đã hết số thứ tự cho tiền tố đăng nhập này.',
      );
    }
    const userName = prefix + String(next).padStart(3, '0');
    if (userName.length > 50) {
      throw new ConflictException('ID đăng nhập vượt quá độ dài cho phép.');
    }
    return userName;
  }

  private async resolveOrCreateSchool(
    manager: EntityManager,
    dto: RegisterStudentDto,
  ) {
    if (dto.schoolId) {
      const school = await manager.findOneBy(SchoolEntity, {
        id: dto.schoolId,
      });
      if (!school) throw new NotFoundException('Trường học không tồn tại.');
      if (dto.zoneId && school.zoneId !== dto.zoneId) {
        throw new BadRequestException(
          'Trường học không thuộc khu vực đã chọn.',
        );
      }
      return school;
    }
    const name = this.normalizeName(dto.schoolName || '');
    if (!name) throw new BadRequestException('Vui lòng chọn hoặc nhập trường.');
    const zone = await manager.findOneBy(
      ZoneEntity,
      dto.zoneId ? { id: dto.zoneId } : { code: ILike('HCM') },
    );
    if (!zone) throw new NotFoundException('Không tìm thấy khu vực đăng ký.');
    await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      `student-register:school:${zone.id}:${name.toLowerCase()}`,
    ]);
    const schools = await manager.findBy(SchoolEntity, { zoneId: zone.id });
    const existing = schools.filter(
      (school) =>
        this.normalizeName(school.name).toLowerCase() === name.toLowerCase(),
    );
    if (existing.length > 1)
      throw new ConflictException(
        'Có nhiều trường trùng tên. Vui lòng chọn trường trong danh sách.',
      );
    if (existing[0]) return existing[0];
    return manager.save(
      SchoolEntity,
      manager.create(SchoolEntity, {
        name,
        code: `REG-${randomUUID()}`,
        zoneId: zone.id,
      }),
    );
  }

  private async resolveOrCreateClass(
    manager: EntityManager,
    schoolId: string,
    dto: RegisterStudentDto,
  ) {
    if (dto.classId) {
      const group = await manager.findOneBy(StudentGroupEntity, {
        id: dto.classId,
        schoolId,
      });
      if (!group)
        throw new BadRequestException('Lớp học không thuộc trường đã chọn.');
      return group;
    }
    const name = this.normalizeName(dto.className || '');
    if (!name) throw new BadRequestException('Vui lòng chọn hoặc nhập lớp.');
    // Serialize the per-school numeric code allocation as well as name resolution.
    await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      `student-register:classes:${schoolId}`,
    ]);
    const groups = await manager.findBy(StudentGroupEntity, { schoolId });
    const existing = groups.filter(
      (group) =>
        this.normalizeName(group.name).toLowerCase() === name.toLowerCase(),
    );
    if (existing.length > 1)
      throw new ConflictException(
        'Có nhiều lớp trùng tên. Vui lòng chọn lớp trong danh sách.',
      );
    if (existing[0]) return existing[0];
    const code = Math.max(0, ...groups.map((group) => group.code)) + 1;
    return manager.save(
      StudentGroupEntity,
      manager.create(StudentGroupEntity, {
        schoolId,
        name,
        code,
      }),
    );
  }

  schools() {
    return this.dataSource
      .getRepository(SchoolEntity)
      .find({ select: { id: true, name: true }, order: { name: 'ASC' } });
  }

  zones() {
    return this.dataSource.getRepository(ZoneEntity).find({
      select: { id: true, code: true, name: true },
      order: { name: 'ASC' },
    });
  }

  hcmSchoolsAndClasses() {
    return this.schoolsAndClassesForZone({ code: ILike('HCM') });
  }

  zoneSchoolsAndClasses(zoneId: string) {
    return this.schoolsAndClassesForZone({ id: zoneId });
  }

  private async schoolsAndClassesForZone(where: FindOptionsWhere<ZoneEntity>) {
    const zone = await this.dataSource.getRepository(ZoneEntity).findOne({
      where,
      select: { id: true, code: true, name: true },
    });
    if (!zone) throw new NotFoundException('Không tìm thấy khu vực đăng ký.');
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
        const school = await this.resolveOrCreateSchool(manager, dto);
        const group = await this.resolveOrCreateClass(manager, school.id, dto);
        const userName = await this.allocateUserName(
          manager,
          school.name,
          group.name,
        );
        await mkdir(directory, { recursive: true });
        await writeFile(filePath, image, { flag: 'wx' });
        fileWritten = true;
        const avatar = `/uploads/student-registration/${filename}`;
        const user = await manager.save(
          UserEntity,
          manager.create(UserEntity, {
            userName,
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
            code: userName,
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
          schoolId: school.id,
          classId: group.id,
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
