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

    const service = new QuestionBankImportService(
      questionBankRepo as any,
      questionBankQuestionRepo as any,
      questionService as any,
      answerService as any,
      {} as any,
      questionParser as any,
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
});
