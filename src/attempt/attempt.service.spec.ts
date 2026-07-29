import { ContentTypes } from 'src/common/enum/content-type.enum';
import { AttemptService } from './attempt.service';
import { QuestionType } from 'src/question/enum/question-type.enum';
import { AttemptStatus } from './enum/attempt-status.enum';
import { AttemptEntity } from './attempt.entity';
import { StudentEntity } from 'src/student/student.entity';
import { UserEntity } from 'src/user/user.entity';
import { StudentGroupEntity } from 'src/student-group/student-group.entity';
import { SchoolEntity } from 'src/school/school.entity';

describe('AttemptService', () => {
  it('maps nextContent from loaded chain when root entity nextContent is missing', () => {
    const service = createService();

    const questionResult = (service as any).mapQuestionChain([
      {
        id: 'question-1',
        type: QuestionType.SINGLE_CHOICE,
        contentType: ContentTypes.TEXT,
        content: 'Question text',
        meta: null,
        nextContent: null,
      },
      {
        id: 'question-2',
        type: QuestionType.SINGLE_CHOICE,
        contentType: ContentTypes.IMAGE,
        content: '/uploads/question-image.png',
        meta: null,
        nextContent: null,
      },
    ]);
    const answerResult = (service as any).mapAnswerChain([
      {
        id: 'answer-1',
        contentType: ContentTypes.TEXT,
        content: 'Answer text',
        meta: null,
        nextContent: null,
      },
      {
        id: 'answer-2',
        contentType: ContentTypes.IMAGE,
        content: '/uploads/answer-image.png',
        meta: null,
        nextContent: null,
      },
    ]);

    expect(questionResult[0].nextContent).toBe('question-2');
    expect(questionResult[1].nextContent).toBeNull();
    expect(answerResult.nextContent).toBe('answer-2');
    expect(answerResult.chain[0].nextContent).toBe('answer-2');
    expect(answerResult.chain[1].nextContent).toBeNull();
  });

  it('creates a student in the public attempt class and starts their attempt', async () => {
    const deps = createServiceDependencies();
    const service = createService(deps);
    const startedAt = new Date();

    deps.questionBankService.findOne.mockResolvedValue({
      id: 'bank-1',
      name: 'Đề thi thử',
    });
    deps.schoolRepo.findOne.mockResolvedValue({
      id: 'school-1',
      code: 'di-ichi',
      name: 'Di-ichi',
    });
    deps.studentGroupRepo.findOne.mockResolvedValue({
      id: 'group-1',
      name: 'test tiếng anh đầu vào',
      schoolId: 'school-1',
    });
    deps.attemptRepo.create.mockImplementation((value) => value);
    deps.attemptRepo.save.mockImplementation((value) => ({
      ...value,
      id: 'attempt-1',
      startedAt,
    }));
    jest.spyOn(service as any, 'getExamQuestions').mockResolvedValue([]);

    const result = await service.startPublic({
      guestName: '  Nguyễn Văn A  ',
      questionBankId: 'bank-1',
    });

    expect(deps.attemptRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        studentId: expect.any(String),
        guestName: 'Nguyễn Văn A',
        questionBankId: 'bank-1',
        status: AttemptStatus.DOING,
      }),
    );
    expect(deps.userRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: expect.any(String),
        fullName: 'Nguyễn Văn A',
        userType: 'STUDENT',
        status: 'INACTIVE',
        isDisabled: true,
      }),
    );
    expect(deps.studentRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: expect.any(String),
        studentGroupId: 'group-1',
        schoolId: 'school-1',
        code: expect.stringMatching(/^PUBLIC-/),
      }),
    );
    expect(deps.studentRepo.create.mock.calls[0][0].id).toBe(
      deps.attemptRepo.create.mock.calls[0][0].studentId,
    );
    expect(result).toEqual(
      expect.objectContaining({
        attemptId: 'attempt-1',
        studentId: expect.any(String),
        guestName: 'Nguyễn Văn A',
        questionBankName: 'Đề thi thử',
        questions: [],
      }),
    );
  });

  it('rolls back public student creation when the target class is missing', async () => {
    const deps = createServiceDependencies();
    const service = createService(deps);

    deps.questionBankService.findOne.mockResolvedValue({
      id: 'bank-1',
      name: 'Đề thi thử',
    });
    deps.schoolRepo.findOne.mockResolvedValue({
      id: 'school-1',
      code: 'di-ichi',
      name: 'Di-ichi',
    });
    deps.studentGroupRepo.findOne.mockResolvedValue(null);

    await expect(
      service.startPublic({
        guestName: 'Nguyễn Văn A',
        questionBankId: 'bank-1',
      }),
    ).rejects.toThrow(
      'Không tìm thấy lớp test tiếng anh đầu vào thuộc trường Di-ichi',
    );

    expect(deps.userRepo.save).not.toHaveBeenCalled();
    expect(deps.attemptRepo.save).not.toHaveBeenCalled();
    expect(deps.queryRunner.rollbackTransaction).toHaveBeenCalled();
    expect(deps.queryRunner.commitTransaction).not.toHaveBeenCalled();
  });

  it('ends only an active public attempt', async () => {
    const deps = createServiceDependencies();
    const service = createService(deps);
    const attempt = {
      id: 'attempt-1',
      studentId: 'student-1',
      guestName: 'Nguyễn Văn A',
      questionBankId: 'bank-1',
      status: AttemptStatus.DOING,
      startedAt: new Date(),
    };

    deps.attemptRepo.findOne.mockResolvedValue(attempt);
    deps.questionBankQuestionRepo.find.mockResolvedValue([]);
    deps.attemptRepo.save.mockImplementation((value) => value);

    const result = await service.endPublic('attempt-1', { answers: [] });

    expect(deps.attemptRepo.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'attempt-1',
          guestName: expect.anything(),
          status: AttemptStatus.DOING,
        }),
      }),
    );
    expect(deps.studentAnswerRepo.delete).toHaveBeenCalledWith({
      attemptId: 'attempt-1',
    });
    expect(result).toEqual(
      expect.objectContaining({
        attemptId: 'attempt-1',
        status: AttemptStatus.SUBMITTED,
        totalQuestions: 0,
        answeredQuestions: 0,
        score: 0,
      }),
    );
  });
});

function createServiceDependencies() {
  const deps = {
    attemptRepo: {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      manager: {} as any,
    },
    studentRepo: {
      create: jest.fn((value) => value),
      save: jest.fn((value) => value),
    },
    userRepo: {
      create: jest.fn((value) => value),
      save: jest.fn((value) => value),
    },
    studentGroupRepo: {
      findOne: jest.fn(),
    },
    schoolRepo: {
      findOne: jest.fn(),
    },
    questionBankQuestionRepo: {
      find: jest.fn(),
    },
    questionRepo: {},
    answerRepo: {},
    studentAnswerRepo: {
      delete: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
    },
    studentService: {},
    questionBankService: {
      findOne: jest.fn(),
    },
    questionBankQuestionPayloadService: {},
    examSetService: {
      findOne: jest.fn(),
    },
    examSetQuestionBankService: {},
  };

  const repositories = new Map<unknown, unknown>([
    [AttemptEntity, deps.attemptRepo],
    [StudentEntity, deps.studentRepo],
    [UserEntity, deps.userRepo],
    [StudentGroupEntity, deps.studentGroupRepo],
    [SchoolEntity, deps.schoolRepo],
  ]);
  const queryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      getRepository: jest.fn((entity) => repositories.get(entity)),
    },
  };
  deps.attemptRepo.manager = {
    connection: {
      createQueryRunner: jest.fn(() => queryRunner),
    },
  };

  return { ...deps, queryRunner };
}

function createService(deps = createServiceDependencies()): AttemptService {
  return new AttemptService(
    deps.attemptRepo as any,
    deps.studentRepo as any,
    deps.userRepo as any,
    deps.studentGroupRepo as any,
    deps.schoolRepo as any,
    deps.questionBankQuestionRepo as any,
    deps.questionRepo as any,
    deps.answerRepo as any,
    deps.studentAnswerRepo as any,
    deps.studentService as any,
    deps.questionBankService as any,
    deps.questionBankQuestionPayloadService as any,
    deps.examSetService as any,
    deps.examSetQuestionBankService as any,
  );
}
