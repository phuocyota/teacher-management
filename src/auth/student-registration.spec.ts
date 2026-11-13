import {
  INestApplication,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from 'src/common/guard/auth.guard';
import request from 'supertest';
import type { Server } from 'node:http';
import { DataSource, EntityManager, ILike, In } from 'typeorm';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import bcrypt from 'bcryptjs';
import { StudentRegistrationController } from './student-registration.controller';
import { StudentRegistrationService } from './student-registration.service';
import { AuthService } from './auth.service';
import { UserEntity } from 'src/user/user.entity';
import { StudentEntity } from 'src/student/student.entity';
import { StudentGroupMemberEntity } from 'src/student-group/student-group-member.entity';
import { RegisterStudentDto } from './dto/register-student.dto';
import { UserType } from 'src/common/enum/user-type.enum';
import { TokenEntity } from './token.entity';
import { ZoneEntity } from 'src/zone/zone.entity';
import { SchoolEntity } from 'src/school/school.entity';
import { StudentGroupEntity } from 'src/student-group/student-group.entity';

const dto: RegisterStudentDto = {
  password: 'a-password',
  fullName: 'Nguyễn Văn An',
  schoolId: '2233abe3-1961-4af5-a482-542f1227d844',
  classId: '3344abe3-1961-4af5-a482-542f1227d855',
  phoneNumber: '0912345678',
};

describe('Public student registration HTTP', () => {
  let app: INestApplication<Server>;
  const registration = {
    register: jest.fn(),
    schools: jest.fn(),
    classes: jest.fn(),
    hcmSchoolsAndClasses: jest.fn(),
    zones: jest.fn(),
    zoneSchoolsAndClasses: jest.fn(),
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [StudentRegistrationController],
      providers: [
        { provide: StudentRegistrationService, useValue: registration },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalGuards(new AuthGuard(app.get(Reflector)));
    await app.init();
  });
  afterAll(() => app.close());
  beforeEach(() => jest.resetAllMocks());

  const submit = (
    fields: Record<string, string> = dto as unknown as Record<string, string>,
    photo = Buffer.from('photo'),
  ) => {
    const req = request(app.getHttpServer()).post('/auth/register/student');
    for (const [key, value] of Object.entries(fields)) req.field(key, value);
    return req.attach('photo', photo, 'student.jpg');
  };

  it('accepts multipart with trimmed names, preserves password and normalized optional phone', async () => {
    registration.register.mockResolvedValue({
      userId: 'saved-user',
      accessToken: 'session',
    });
    await submit({
      ...dto,
      fullName: ` ${dto.fullName} `,
      password: ' password ',
      phoneNumber: '091 234 5678',
    }).expect(201);
    expect(registration.register).toHaveBeenCalledWith(
      expect.objectContaining({
        fullName: dto.fullName,
        password: ' password ',
        phoneNumber: '0912345678',
      }),
      expect.objectContaining({ buffer: Buffer.from('photo') }),
    );
  });
  it.each([
    { ...dto, userName: 'x'.repeat(51) },
    { ...dto, password: '123' },
    { ...dto, schoolId: 'invalid' },
    { ...dto, classId: 'invalid' },
    { ...dto, phoneNumber: '1234' },
    { ...dto, fullName: '  ' },
    { ...dto, userType: 'ADMIN' },
  ])(
    'rejects invalid or privileged input before persistence',
    async (fields) => {
      await submit(fields).expect(400);
      expect(registration.register).not.toHaveBeenCalled();
    },
  );
  it('rejects images above 5MB before persistence', async () => {
    await submit(
      dto as unknown as Record<string, string>,
      Buffer.alloc(5 * 1024 * 1024 + 1),
    ).expect(413);
    expect(registration.register).not.toHaveBeenCalled();
  });
  it('accepts typed school and class names without IDs', async () => {
    const student = { ...dto };
    delete student.schoolId;
    delete student.classId;
    registration.register.mockResolvedValue({ accessToken: 'session' });
    await submit({
      ...student,
      schoolName: '  School  ',
      className: '  5A  ',
    }).expect(201);
    expect(registration.register).toHaveBeenCalledWith(
      expect.objectContaining({ schoolName: 'School', className: '5A' }),
      expect.anything(),
    );
  });
  it.each(['school', 'class'])(
    'requires either an ID or a name for %s',
    async (field) => {
      const values = { ...dto } as Record<string, string>;
      delete values[`${field}Id`];
      await submit(values).expect(400);
      expect(registration.register).not.toHaveBeenCalled();
    },
  );
  it('rejects whitespace-only and oversized typed names', async () => {
    const student = { ...dto };
    delete student.schoolId;
    delete student.classId;
    await submit({ ...student, schoolName: '  ', className: '5A' }).expect(400);
    await submit({
      ...student,
      schoolName: 'School',
      className: 'x'.repeat(256),
    }).expect(400);
    expect(registration.register).not.toHaveBeenCalled();
  });
  it('provides public school/class selectors and validates school ID', async () => {
    registration.schools.mockResolvedValue([
      { id: dto.schoolId, name: 'School' },
    ]);
    registration.classes.mockResolvedValue([{ id: dto.classId, name: '5A' }]);
    await request(app.getHttpServer())
      .get('/auth/register/student/schools')
      .expect(200, [{ id: dto.schoolId, name: 'School' }]);
    await request(app.getHttpServer())
      .get(`/auth/register/student/schools/${dto.schoolId}/classes`)
      .expect(200);
    await request(app.getHttpServer())
      .get('/auth/register/student/schools/invalid/classes')
      .expect(400);
    expect(registration.classes).toHaveBeenCalledTimes(1);
  });
  it('provides public zones and scopes school lookup by a validated zone ID', async () => {
    const zoneId = '1122abe3-1961-4af5-a482-542f1227d833';
    const zones = [{ id: zoneId, code: 'DL', name: 'Đà Lạt' }];
    const payload = { zone: zones[0], schools: [] };
    registration.zones.mockResolvedValue(zones);
    registration.zoneSchoolsAndClasses.mockResolvedValue(payload);
    await request(app.getHttpServer())
      .get('/auth/register/student/zones')
      .expect(200, zones);
    await request(app.getHttpServer())
      .get('/auth/register/student/zones/' + zoneId + '/schools')
      .expect(200, payload);
    await request(app.getHttpServer())
      .get('/auth/register/student/zones/invalid/schools')
      .expect(400);
    expect(registration.zoneSchoolsAndClasses).toHaveBeenCalledTimes(1);
    expect(registration.zoneSchoolsAndClasses).toHaveBeenCalledWith(zoneId);
  });
  it('accepts a selected zone and rejects malformed zone IDs', async () => {
    const zoneId = '1122abe3-1961-4af5-a482-542f1227d833';
    await submit({ ...dto, zoneId }).expect(201);
    expect(registration.register).toHaveBeenCalledWith(
      expect.objectContaining({ zoneId }),
      expect.anything(),
    );
    registration.register.mockClear();
    await submit({ ...dto, zoneId: 'invalid' }).expect(400);
    expect(registration.register).not.toHaveBeenCalled();
  });
  it('returns HCM schools and classes in one public request', async () => {
    const payload = {
      zone: { id: 'hcm', code: 'HCM', name: 'Hồ Chí Minh' },
      schools: [
        {
          id: dto.schoolId,
          name: 'School',
          classes: [{ id: dto.classId, name: '5A' }],
        },
      ],
    };
    registration.hcmSchoolsAndClasses.mockResolvedValue(payload);
    await request(app.getHttpServer())
      .get('/auth/register/student/zones/HCM/schools')
      .expect(200, payload);
    expect(registration.hcmSchoolsAndClasses).toHaveBeenCalledTimes(1);
  });
});

describe('HCM registration school/class lookup', () => {
  const zone = { id: 'hcm-id', code: 'HCM', name: 'Hồ Chí Minh' };
  const zones = { findOne: jest.fn(), find: jest.fn() };
  const schools = { find: jest.fn() };
  const groups = { find: jest.fn() };
  const source = {
    getRepository: jest.fn((entity: unknown) =>
      entity === ZoneEntity
        ? zones
        : entity === SchoolEntity
          ? schools
          : groups,
    ),
  };
  const service = new StudentRegistrationService(
    source as unknown as DataSource,
    {} as AuthService,
  );
  beforeEach(() => {
    jest.clearAllMocks();
    source.getRepository.mockImplementation((entity: unknown) =>
      entity === ZoneEntity
        ? zones
        : entity === SchoolEntity
          ? schools
          : groups,
    );
    zones.findOne.mockResolvedValue(zone);
    schools.find.mockResolvedValue([
      { id: 'school-1', name: 'Trường 1' },
      { id: 'school-2', name: 'Trường 2' },
    ]);
    groups.find.mockResolvedValue([
      { id: 'class-1', name: '5A', schoolId: 'school-1' },
      { id: 'class-2', name: '5B', schoolId: 'school-1' },
    ]);
  });
  it('filters schools by HCM zone and attaches each class to its own school', async () => {
    const result = await service.hcmSchoolsAndClasses();
    expect(zones.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: { code: ILike('HCM') } }),
    );
    expect(schools.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { zoneId: zone.id } }),
    );
    expect(source.getRepository).toHaveBeenCalledWith(StudentGroupEntity);
    expect(groups.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { schoolId: In(['school-1', 'school-2']) },
      }),
    );
    expect(result).toEqual({
      zone,
      schools: [
        {
          id: 'school-1',
          name: 'Trường 1',
          classes: [
            { id: 'class-1', name: '5A' },
            { id: 'class-2', name: '5B' },
          ],
        },
        { id: 'school-2', name: 'Trường 2', classes: [] },
      ],
    });
  });
  it('lists public zones and loads schools in a selected non-HCM zone', async () => {
    const selected = { id: 'other-zone', code: 'DL', name: 'Đà Lạt' };
    zones.find.mockResolvedValue([selected]);
    expect(await service.zones()).toEqual([selected]);
    expect(zones.find).toHaveBeenCalledWith({
      select: { id: true, code: true, name: true },
      order: { name: 'ASC' },
    });
    zones.findOne.mockResolvedValue(selected);
    const result = await service.zoneSchoolsAndClasses(selected.id);
    expect(zones.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: selected.id } }),
    );
    expect(schools.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { zoneId: selected.id } }),
    );
    expect(result.zone).toEqual(selected);
  });
  it('rejects an unknown selected zone without querying all schools', async () => {
    zones.findOne.mockResolvedValue(null);
    await expect(
      service.zoneSchoolsAndClasses('missing'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(schools.find).not.toHaveBeenCalled();
  });
  it('reports a missing HCM zone instead of falling back to all schools', async () => {
    zones.findOne.mockResolvedValue(null);
    await expect(service.hcmSchoolsAndClasses()).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(schools.find).not.toHaveBeenCalled();
    expect(groups.find).not.toHaveBeenCalled();
  });
  it('returns an empty list and skips the class query when HCM has no schools', async () => {
    schools.find.mockResolvedValue([]);
    expect(await service.hcmSchoolsAndClasses()).toEqual({ zone, schools: [] });
    expect(groups.find).not.toHaveBeenCalled();
  });
});

describe('Student registration persistence', () => {
  let directory: string;
  let oldUploadDir: string | undefined;
  let photo: { buffer: Buffer };
  const query = { where: jest.fn().mockReturnThis(), getOne: jest.fn() };
  const manager = {
    query: jest.fn(),
    getRepository: jest.fn(() => ({ createQueryBuilder: () => query })),
    findOneBy: jest.fn(),
    findBy: jest.fn(),
    create: jest.fn((_entity: unknown, values: object) => values),
    save: jest.fn(),
  };
  const source = { transaction: jest.fn() };
  const auth = { createStudentRegistrationSession: jest.fn() };
  const service = new StudentRegistrationService(
    source as unknown as DataSource,
    auth as unknown as AuthService,
  );
  beforeEach(async () => {
    jest.resetAllMocks();
    manager.getRepository.mockImplementation(() => ({
      createQueryBuilder: () => query,
    }));
    query.where.mockReturnThis();
    manager.create.mockImplementation(
      (_entity: unknown, values: object) => values,
    );
    oldUploadDir = process.env.UPLOAD_DIR;
    directory = await mkdtemp(join(tmpdir(), 'student-registration-'));
    process.env.UPLOAD_DIR = directory;
    photo = {
      buffer: await sharp({
        create: { width: 10, height: 10, channels: 3, background: '#008037' },
      })
        .png()
        .toBuffer(),
    };
    query.getOne.mockResolvedValue(null);
    manager.query.mockResolvedValue([{ lastNumber: '0' }]);
    manager.findOneBy
      .mockResolvedValueOnce({ id: dto.schoolId, name: 'School' })
      .mockResolvedValueOnce({
        id: dto.classId,
        schoolId: dto.schoolId,
        name: '5A',
      });
    manager.save.mockImplementation((_entity: unknown, value: object) =>
      Promise.resolve({ ...value, id: 'saved-id' }),
    );
    source.transaction.mockImplementation(
      (callback: (m: typeof manager) => unknown) => callback(manager),
    );
    auth.createStudentRegistrationSession.mockResolvedValue({
      accessToken: 'session',
      userId: 'saved-id',
      userType: UserType.STUDENT,
    });
  });
  afterEach(async () => {
    if (oldUploadDir === undefined) delete process.env.UPLOAD_DIR;
    else process.env.UPLOAD_DIR = oldUploadDir;
    await rm(directory, { recursive: true, force: true });
  });
  it('saves user, profile, class membership and session together with a real JPEG', async () => {
    const result = await service.register(dto, photo);
    expect(source.transaction).toHaveBeenCalledTimes(1);
    const saveCalls = manager.save.mock.calls as unknown as [
      unknown,
      UserEntity,
    ][];
    const user = saveCalls.find(
      ([entity]) => entity === UserEntity,
    )?.[1] as unknown as UserEntity;
    expect(user.userType).toBe(UserType.STUDENT);
    expect(await bcrypt.compare(dto.password, user.hashPassword)).toBe(true);
    expect(manager.save).toHaveBeenCalledWith(
      StudentEntity,
      expect.objectContaining({
        id: 'saved-id',
        code: 'S5A001',
        schoolId: dto.schoolId,
        studentGroupId: dto.classId,
      }),
    );
    expect(manager.save).toHaveBeenCalledWith(
      StudentGroupMemberEntity,
      expect.objectContaining({
        userId: 'saved-id',
        studentGroupId: dto.classId,
      }),
    );
    expect(auth.createStudentRegistrationSession).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'saved-id' }),
      manager,
    );
    expect(result).toMatchObject({
      accessToken: 'session',
      userId: 'saved-id',
      schoolName: 'School',
      className: '5A',
    });
    expect(JSON.stringify(result)).not.toContain(dto.password);
    expect(JSON.stringify(result)).not.toContain('hashPassword');
    const files = await readdir(join(directory, 'student-registration'));
    expect(files).toHaveLength(1);
    expect(
      (
        await sharp(
          join(directory, 'student-registration', files[0]),
        ).metadata()
      ).format,
    ).toBe('jpeg');
  });
  it('continues the existing sequence and ignores a supplied login ID', async () => {
    manager.query.mockResolvedValue([{ lastNumber: '12' }]);
    const result = await service.register(
      { ...dto, userName: 'arbitrary' },
      photo,
    );
    expect(result.userName).toBe('S5A013');
    expect(manager.query).toHaveBeenCalledWith(
      'SELECT pg_advisory_xact_lock(hashtext($1))',
      ['student-register:username-allocation'],
    );
  });
  it('removes Vietnamese accents and preserves class digits in the login ID', async () => {
    manager.findOneBy
      .mockReset()
      .mockResolvedValueOnce({ id: dto.schoolId, name: 'Nguyễn Đình Chiểu' })
      .mockResolvedValueOnce({
        id: dto.classId,
        name: 'Lớp 5A',
        schoolId: dto.schoolId,
      });
    const result = await service.register(dto, photo);
    expect(result.userName).toBe('NDC5A001');
  });
  it.each([
    ['Trường Tiểu học Nguyễn Du', 'Lớp 5 A1', 'THND5A1001'],
    ['Trường TH Nguyễn Du', '5A1', 'THND5A1001'],
    ['Trường Trung học cơ sở Đặng Văn Ngữ', '6A', 'THCSDVN6A001'],
    ['Trường THCS Đặng Văn Ngữ', '6A', 'THCSDVN6A001'],
    ['  trường   mầm non Hoa Sen ', 'Chồi 1', 'MNHSC1001'],
    ['Nguyễn-Du', '5A', 'ND5A001'],
  ])(
    'generates a canonical ID for %s / %s',
    async (school, className, expected) => {
      manager.findOneBy
        .mockReset()
        .mockResolvedValueOnce({ id: dto.schoolId, name: school })
        .mockResolvedValueOnce({
          id: dto.classId,
          name: className,
          schoolId: dto.schoolId,
        });
      const result = await service.register(dto, photo);
      expect(result.userName).toBe(expected);
    },
  );
  it('continues beyond 999 without truncating or resetting the sequence', async () => {
    manager.query.mockResolvedValue([{ lastNumber: '999' }]);
    expect((await service.register(dto, photo)).userName).toBe('S5A1000');
  });
  it('rejects names without a usable school/class code before writing files', async () => {
    manager.findOneBy
      .mockReset()
      .mockResolvedValueOnce({ id: dto.schoolId, name: '---' })
      .mockResolvedValueOnce({
        id: dto.classId,
        name: 'Lớp',
        schoolId: dto.schoolId,
      });
    await expect(service.register(dto, photo)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(manager.save).not.toHaveBeenCalled();
    expect(await readdir(directory)).toEqual([]);
  });
  it('reuses normalized school and class names and links their existing IDs', async () => {
    manager.findOneBy.mockReset().mockResolvedValue({ id: 'hcm-zone' });
    manager.findBy.mockImplementation((entity: unknown) =>
      Promise.resolve(
        entity === SchoolEntity
          ? [{ id: dto.schoolId, name: 'School   Name', zoneId: 'hcm-zone' }]
          : [{ id: dto.classId, name: '5A', code: 4, schoolId: dto.schoolId }],
      ),
    );
    const result = await service.register(
      {
        ...dto,
        schoolId: undefined,
        classId: undefined,
        schoolName: ' school name ',
        className: ' 5a ',
      },
      photo,
    );
    expect(result).toMatchObject({
      schoolId: dto.schoolId,
      classId: dto.classId,
    });
    expect(manager.findBy).toHaveBeenCalledWith(SchoolEntity, {
      zoneId: 'hcm-zone',
    });
    expect(manager.findBy).toHaveBeenCalledWith(StudentGroupEntity, {
      schoolId: dto.schoolId,
    });
    expect(
      manager.save.mock.calls.some(
        ([entity]) => entity === SchoolEntity || entity === StudentGroupEntity,
      ),
    ).toBe(false);
  });
  it('creates a new school in HCM and a class in the same registration transaction', async () => {
    manager.findOneBy.mockReset().mockResolvedValue({ id: 'hcm-zone' });
    manager.findBy.mockResolvedValue([]);
    manager.save.mockImplementation((entity: unknown, value: object) =>
      Promise.resolve({
        ...value,
        id:
          entity === SchoolEntity
            ? 'new-school'
            : entity === StudentGroupEntity
              ? 'new-class'
              : 'saved-id',
      }),
    );
    const result = await service.register(
      {
        ...dto,
        schoolId: undefined,
        classId: undefined,
        schoolName: ' New   School ',
        className: ' 5A ',
      },
      photo,
    );
    expect(manager.save).toHaveBeenCalledWith(
      SchoolEntity,
      expect.objectContaining({
        name: 'New School',
        zoneId: 'hcm-zone',
      }),
    );
    expect(manager.save).toHaveBeenCalledWith(
      StudentGroupEntity,
      expect.objectContaining({ name: '5A', schoolId: 'new-school', code: 1 }),
    );
    expect(manager.save).toHaveBeenCalledWith(
      StudentEntity,
      expect.objectContaining({
        schoolId: 'new-school',
        studentGroupId: 'new-class',
      }),
    );
    expect(manager.query).toHaveBeenCalledWith(
      'SELECT pg_advisory_xact_lock(hashtext($1))',
      ['student-register:school:hcm-zone:new school'],
    );
    expect(manager.query).toHaveBeenCalledWith(
      'SELECT pg_advisory_xact_lock(hashtext($1))',
      ['student-register:classes:new-school'],
    );
    expect(result).toMatchObject({
      schoolId: 'new-school',
      classId: 'new-class',
    });
    expect(source.transaction).toHaveBeenCalledTimes(1);
  });
  it('creates a class with the next code only inside the selected school', async () => {
    manager.findBy.mockResolvedValue([
      { id: 'other-class', name: '4A', code: 7 },
    ]);
    await service.register(
      { ...dto, classId: undefined, className: '5A' },
      photo,
    );
    expect(manager.save).toHaveBeenCalledWith(
      StudentGroupEntity,
      expect.objectContaining({ schoolId: dto.schoolId, name: '5A', code: 8 }),
    );
  });
  it('reports an absent HCM zone before creating a school', async () => {
    manager.findOneBy.mockReset().mockResolvedValue(null);
    await expect(
      service.register(
        { ...dto, schoolId: undefined, schoolName: 'School' },
        photo,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(manager.save).not.toHaveBeenCalled();
  });
  it('reports ambiguous existing names instead of creating or choosing an arbitrary school', async () => {
    manager.findOneBy.mockReset().mockResolvedValue({ id: 'hcm-zone' });
    manager.findBy.mockResolvedValue([
      { id: 'one', name: 'School' },
      { id: 'two', name: ' school ' },
    ]);
    await expect(
      service.register(
        { ...dto, schoolId: undefined, schoolName: 'School' },
        photo,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(manager.save).not.toHaveBeenCalled();
  });
  it('rejects a school outside the selected zone before saving records', async () => {
    manager.findOneBy
      .mockReset()
      .mockResolvedValueOnce({ id: dto.schoolId, zoneId: 'other-zone' });
    await expect(
      service.register({ ...dto, zoneId: 'selected-zone' }, photo),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(manager.save).not.toHaveBeenCalled();
    expect(auth.createStudentRegistrationSession).not.toHaveBeenCalled();
    expect(await readdir(directory)).toEqual([]);
  });
  it('accepts a school belonging to the selected zone', async () => {
    manager.findOneBy
      .mockReset()
      .mockResolvedValueOnce({
        id: dto.schoolId,
        name: 'School',
        zoneId: 'selected-zone',
      })
      .mockResolvedValueOnce({
        id: dto.classId,
        schoolId: dto.schoolId,
        name: '5A',
      });
    await service.register({ ...dto, zoneId: 'selected-zone' }, photo);
    expect(auth.createStudentRegistrationSession).toHaveBeenCalled();
  });
  it('rejects a class outside the selected school without writes', async () => {
    manager.findOneBy
      .mockReset()
      .mockResolvedValueOnce({ id: dto.schoolId })
      .mockResolvedValueOnce(null);
    await expect(service.register(dto, photo)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(manager.save).not.toHaveBeenCalled();
  });
  it('removes the uploaded image if the database transaction fails', async () => {
    manager.save.mockRejectedValueOnce(new Error('database failed'));
    await expect(service.register(dto, photo)).rejects.toThrow(
      'database failed',
    );
    expect(await readdir(join(directory, 'student-registration'))).toEqual([]);
  });
  it('removes the image and rejects when session persistence fails', async () => {
    auth.createStudentRegistrationSession.mockRejectedValueOnce(
      new Error('session failed'),
    );
    await expect(service.register(dto, photo)).rejects.toThrow(
      'session failed',
    );
    expect(await readdir(join(directory, 'student-registration'))).toEqual([]);
  });
  it('rejects missing or invalid photo bytes before opening a transaction', async () => {
    await expect(service.register(dto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      service.register(dto, { buffer: Buffer.from('not an image') }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(source.transaction).not.toHaveBeenCalled();
  });
  it('persists the JWT session using the supplied transaction manager', async () => {
    const service = new AuthService({} as never, {} as never);
    const user = { id: 'student-id', userType: UserType.STUDENT } as UserEntity;
    const result = await service.createStudentRegistrationSession(
      user,
      manager as unknown as EntityManager,
    );
    expect(result).toMatchObject({
      userId: user.id,
      userType: UserType.STUDENT,
    });
    expect(manager.save).toHaveBeenCalledWith(
      TokenEntity,
      expect.objectContaining({ userId: user.id, token: result.accessToken }),
    );
  });
});
