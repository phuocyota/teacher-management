import {
  INestApplication,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { Server } from 'node:http';
import { Repository } from 'typeorm';
import { StudentController } from './student.controller';
import { StudentService } from './student.service';
import { StudentEntity } from './student.entity';
import { StudentGroupService } from 'src/student-group/student-group.service';
import { SchoolService } from 'src/school/school.service';
import { StudentResponseDto } from './dto/student.dto';

const profile = {
  image: 'https://example.com/student.jpg',
  fullName: 'Nguyễn Văn An',
  schoolId: '2233abe3-1961-4af5-a482-542f1227d844',
  classId: '3344abe3-1961-4af5-a482-542f1227d855',
  phone: '0901234567',
};

describe('Student profile API', () => {
  let app: INestApplication<Server>;
  const createProfile = jest.fn();

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [StudentController],
      providers: [{ provide: StudentService, useValue: { createProfile } }],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => {
    createProfile.mockReset();
  });

  it('accepts and trims the five fields and preserves the phone string', async () => {
    createProfile.mockImplementation((dto: typeof profile) =>
      Promise.resolve({
        ...dto,
        id: 'student-id',
        studentGroupId: dto.classId,
        school: { name: 'Trường Nguyễn Du' },
        studentGroup: { name: '5A' },
      }),
    );
    const response = await request(app.getHttpServer())
      .post('/student/profile')
      .send({ ...profile, fullName: ` ${profile.fullName} ` })
      .expect(201);
    expect(response.body).toMatchObject(profile);
    expect(createProfile).toHaveBeenCalledWith(
      expect.objectContaining(profile),
    );
  });

  it.each([
    { ...profile, fullName: '   ' },
    { ...profile, phone: 901234567 },
    { ...profile, schoolId: null },
    { ...profile, schoolId: undefined },
    { ...profile, classId: undefined },
    { ...profile, classId: '' },
    { ...profile, classId: 'not-a-uuid' },
    { ...profile, image: 'javascript:alert(1)' },
    { ...profile, image: undefined },
    { ...profile, schoolId: 'unexpected' },
    { ...profile, schoolName: 'Trường Nguyễn Du' },
    { ...profile, className: '5A' },
  ])('rejects invalid input before persistence: %j', async (body) => {
    await request(app.getHttpServer())
      .post('/student/profile')
      .send(body)
      .expect(400);
    expect(createProfile).not.toHaveBeenCalled();
  });
});

describe('Student profile persistence', () => {
  const school = { id: profile.schoolId, name: 'Trường Nguyễn Du' };
  const group = {
    id: profile.classId,
    schoolId: school.id,
    name: '5A',
  };
  const manager = { findOne: jest.fn(), create: jest.fn(), save: jest.fn() };
  const transaction = jest.fn();
  const service = new StudentService(
    { manager: { transaction } } as unknown as Repository<StudentEntity>,
    {} as StudentGroupService,
    {} as SchoolService,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    transaction.mockImplementation(
      (callback: (value: typeof manager) => unknown) => callback(manager),
    );
    manager.create.mockImplementation(
      (_entity: unknown, record: unknown) => record,
    );
    manager.save.mockImplementation((record: unknown) =>
      Promise.resolve(record),
    );
  });

  it('links the existing class within the chosen school and saves all profile fields', async () => {
    manager.findOne.mockResolvedValueOnce(school).mockResolvedValueOnce(group);
    const result = await service.createProfile(profile);
    expect(transaction).toHaveBeenCalledTimes(1);
    const findCalls = manager.findOne.mock.calls as unknown[][];
    const classLookup = findCalls[1]?.[1] as {
      where: { id: string };
    };
    expect(classLookup.where.id).toBe(profile.classId);
    expect(result).toMatchObject({
      fullName: profile.fullName,
      phone: profile.phone,
      image: profile.image,
      schoolId: school.id,
      studentGroupId: group.id,
    });
    expect(result.code).toMatch(/^HS-[0-9a-f-]{36}$/);
    expect(StudentResponseDto.fromEntity(result)).toMatchObject(profile);
    expect(manager.save).toHaveBeenCalledTimes(1);
  });

  it.each([
    { schoolResult: null, groupResult: null, error: NotFoundException },
    { schoolResult: school, groupResult: null, error: NotFoundException },
    {
      schoolResult: school,
      groupResult: { ...group, schoolId: 'another-school' },
      error: BadRequestException,
    },
  ])(
    'does not save for a missing school/class or a class from another school: %j',
    async ({ schoolResult, groupResult, error }) => {
      manager.findOne
        .mockResolvedValueOnce(schoolResult)
        .mockResolvedValueOnce(groupResult);
      await expect(service.createProfile(profile)).rejects.toBeInstanceOf(
        error,
      );
      expect(manager.save).not.toHaveBeenCalled();
    },
  );
});
