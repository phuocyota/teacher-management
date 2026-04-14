import { ContentTypes } from 'src/common/enum/content-type.enum';
import { QuestionType } from 'src/question/enum/question-type.enum';
import { QuestionBankImportService } from './question-bank-import.service';

describe('QuestionBankImportService', () => {
  it('creates a placeholder question part when a question only has answers', async () => {
    const questionBankRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
    };
    const questionBankQuestionRepo = {
      create: jest.fn((value) => value),
      save: jest.fn(),
      count: jest.fn(),
    };
    const questionService = {
      createBulk: jest.fn().mockResolvedValue([
        {
          id: 'question-1',
          content: '',
          contentType: ContentTypes.TEXT,
          type: QuestionType.SINGLE_CHOICE,
        },
      ]),
      updateBulk: jest.fn().mockResolvedValue([]),
    };
    const answerService = {
      createBulk: jest
        .fn()
        .mockImplementation(async (answers) =>
          answers.map((_: unknown, index: number) => ({ id: `answer-${index + 1}` })),
        ),
      updateBulk: jest.fn().mockResolvedValue([]),
    };
    const questionParser = {
      getQuestionType: jest.fn().mockReturnValue(QuestionType.SINGLE_CHOICE),
    };
    const uploadService = {
      saveBufferAsFile: jest.fn(),
    };

    const service = new QuestionBankImportService(
      questionBankRepo as any,
      questionBankQuestionRepo as any,
      questionService as any,
      answerService as any,
      {} as any,
      questionParser as any,
      uploadService as any,
    );

    const createdQuestions: Array<{
      id: string;
      content: string;
      type: QuestionType;
      contentType: ContentTypes;
      answerCount: number;
    }> = [];

    const result = await (service as any).flushQuestionBlock(
      {
        number: 16,
        questionParts: [],
        answerPartsList: [
          [{ content: 'This is a pen.', contentType: ContentTypes.TEXT }],
          [{ content: 'This are a pen.', contentType: ContentTypes.TEXT }],
        ],
        pendingAnswerMedia: [],
        currentAnswerParts: null,
      },
      'question-bank-1',
      createdQuestions,
    );

    expect(questionService.createBulk).toHaveBeenCalledWith([
      {
        type: QuestionType.SINGLE_CHOICE,
        content: '',
        contentType: ContentTypes.TEXT,
        isRoot: true,
      },
    ]);
    expect(answerService.createBulk).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ totalAnswers: 2 });
    expect(createdQuestions).toEqual([
      {
        id: 'question-1',
        content: '',
        type: QuestionType.SINGLE_CHOICE,
        contentType: ContentTypes.TEXT,
        answerCount: 2,
      },
    ]);
  });

  it('uploads image parts and stores the uploaded path in content', async () => {
    const questionBankRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
    };
    const questionBankQuestionRepo = {
      create: jest.fn((value) => value),
      save: jest.fn(),
      count: jest.fn(),
    };
    const questionService = {
      createBulk: jest.fn().mockResolvedValue([
        {
          id: 'question-1',
          content: '',
          contentType: ContentTypes.TEXT,
          type: QuestionType.SINGLE_CHOICE,
        },
      ]),
      updateBulk: jest.fn().mockResolvedValue([]),
    };
    const answerService = {
      createBulk: jest.fn().mockResolvedValue([{ id: 'answer-1' }]),
      updateBulk: jest.fn().mockResolvedValue([]),
    };
    const questionParser = {
      getQuestionType: jest.fn().mockReturnValue(QuestionType.SINGLE_CHOICE),
    };
    const uploadService = {
      saveBufferAsFile: jest.fn().mockResolvedValue({
        path: '/uploads/question-banks/question-bank-1/image-1.png',
      }),
    };

    const service = new QuestionBankImportService(
      questionBankRepo as any,
      questionBankQuestionRepo as any,
      questionService as any,
      answerService as any,
      {} as any,
      questionParser as any,
      uploadService as any,
    );

    const createdQuestions: Array<{
      id: string;
      content: string;
      type: QuestionType;
      contentType: ContentTypes;
      answerCount: number;
    }> = [];

    await (service as any).flushQuestionBlock(
      {
        number: 1,
        questionParts: [],
        answerPartsList: [
          [{ content: 'iVBORw0KGgo=', contentType: ContentTypes.IMAGE }],
        ],
        pendingAnswerMedia: [],
        currentAnswerParts: null,
      },
      'question-bank-1',
      createdQuestions,
    );

    expect(uploadService.saveBufferAsFile).toHaveBeenCalledWith(
      expect.any(Buffer),
      expect.objectContaining({
        originalName: expect.stringContaining('pdf-image-'),
        mimetype: 'image/png',
        uploadedBy: 'pdf-import',
        folderPath: 'question-banks/question-bank-1',
        storedPathPrefix: '/uploads',
      }),
    );
    expect(questionService.createBulk).toHaveBeenCalledWith([
      {
        type: QuestionType.SINGLE_CHOICE,
        content: '',
        contentType: ContentTypes.TEXT,
        isRoot: true,
      },
    ]);
    expect(answerService.createBulk).toHaveBeenCalledWith([
      expect.objectContaining({
        questionId: 'question-1',
        content: '/uploads/question-banks/question-bank-1/image-1.png',
        contentType: ContentTypes.IMAGE,
      }),
    ]);
  });

  it('marks only the first question part as root so chained parts do not appear as standalone questions', async () => {
    const questionBankRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
    };
    const questionBankQuestionRepo = {
      create: jest.fn((value) => value),
      save: jest.fn(),
      count: jest.fn(),
    };
    const questionService = {
      createBulk: jest.fn().mockResolvedValue([
        {
          id: 'question-1',
          content: 'Part 1',
          contentType: ContentTypes.TEXT,
          type: QuestionType.SINGLE_CHOICE,
          isRoot: true,
        },
        {
          id: 'question-2',
          content: 'Part 2',
          contentType: ContentTypes.TEXT,
          type: QuestionType.SINGLE_CHOICE,
          isRoot: false,
        },
      ]),
      updateBulk: jest.fn().mockResolvedValue([]),
    };
    const answerService = {
      createBulk: jest.fn().mockResolvedValue([]),
      updateBulk: jest.fn().mockResolvedValue([]),
    };
    const questionParser = {
      getQuestionType: jest.fn().mockReturnValue(QuestionType.SINGLE_CHOICE),
    };
    const uploadService = {
      saveBufferAsFile: jest.fn(),
    };

    const service = new QuestionBankImportService(
      questionBankRepo as any,
      questionBankQuestionRepo as any,
      questionService as any,
      answerService as any,
      {} as any,
      questionParser as any,
      uploadService as any,
    );

    const createdQuestions: Array<{
      id: string;
      content: string;
      type: QuestionType;
      contentType: ContentTypes;
      answerCount: number;
    }> = [];

    await (service as any).flushQuestionBlock(
      {
        number: 1,
        questionParts: [
          { content: 'Part 1', contentType: ContentTypes.TEXT },
          { content: 'Part 2', contentType: ContentTypes.TEXT },
        ],
        answerPartsList: [],
        pendingAnswerMedia: [],
        currentAnswerParts: null,
      },
      'question-bank-1',
      createdQuestions,
    );

    expect(questionService.createBulk).toHaveBeenCalledWith([
      {
        type: QuestionType.SINGLE_CHOICE,
        content: 'Part 1',
        contentType: ContentTypes.TEXT,
        isRoot: true,
      },
      {
        type: QuestionType.SINGLE_CHOICE,
        content: 'Part 2',
        contentType: ContentTypes.TEXT,
        isRoot: false,
      },
    ]);
  });
});
