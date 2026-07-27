import { ContentTypes } from 'src/common/enum/content-type.enum';
import { AttemptService } from './attempt.service';
import { QuestionType } from 'src/question/enum/question-type.enum';
import { AttemptStatus } from './enum/attempt-status.enum';

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

  it('starts a public attempt with guest name and without student id', async () => {
    const deps = createServiceDependencies();
    const service = createService(deps);
    const startedAt = new Date();

    deps.questionBankService.findOne.mockResolvedValue({
      id: 'bank-1',
      name: 'Đề thi thử',
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
        studentId: null,
        guestName: 'Nguyễn Văn A',
        questionBankId: 'bank-1',
        status: AttemptStatus.DOING,
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        attemptId: 'attempt-1',
        studentId: null,
        guestName: 'Nguyễn Văn A',
        questionBankName: 'Đề thi thử',
        questions: [],
      }),
    );
  });

  it('ends only an active public attempt', async () => {
    const deps = createServiceDependencies();
    const service = createService(deps);
    const attempt = {
      id: 'attempt-1',
      studentId: null,
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
  return {
    attemptRepo: {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
    },
    studentRepo: {},
    userRepo: {},
    studentGroupRepo: {},
    schoolRepo: {},
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
