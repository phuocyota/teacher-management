import { ContentTypes } from 'src/common/enum/content-type.enum';
import { QuestionType } from './enum/question-type.enum';
import { QuestionService } from './question.service';

describe('QuestionService', () => {
  it('removes question and answer image files when deleting a question chain', async () => {
    const deps = createServiceDependencies();
    deps.questionRepo.findOne
      .mockResolvedValueOnce({
        id: 'question-1',
        contentType: ContentTypes.IMAGE,
        content: '/uploads/question-image.png',
        nextContent: 'question-2',
      })
      .mockResolvedValueOnce({
        id: 'question-2',
        contentType: ContentTypes.TEXT,
        content: 'text part',
        nextContent: null,
      });
    deps.answerRepo.find.mockResolvedValue([
      {
        id: 'answer-1',
        questionId: 'question-1',
        contentType: ContentTypes.TEXT,
        content: 'answer text',
        nextContent: 'answer-2',
      },
      {
        id: 'answer-2',
        questionId: 'question-1',
        contentType: ContentTypes.IMAGE,
        content: '/uploads/answer-image.png',
        nextContent: null,
      },
    ]);
    const service = createService(deps);

    await service.remove('question-1');

    expect(deps.uploadService.deleteFileByPath).toHaveBeenCalledWith(
      '/uploads/question-image.png',
    );
    expect(deps.uploadService.deleteFileByPath).toHaveBeenCalledWith(
      '/uploads/answer-image.png',
    );
    expect(deps.answerRepo.remove).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'answer-1' }),
      expect.objectContaining({ id: 'answer-2' }),
    ]);
    expect(deps.questionRepo.remove).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'question-1' }),
      expect.objectContaining({ id: 'question-2' }),
    ]);
  });
});

function createServiceDependencies() {
  return {
    questionRepo: {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      remove: jest.fn(),
    },
    answerRepo: {
      find: jest.fn(),
      remove: jest.fn(),
    },
    questionBankService: {
      findOne: jest.fn(),
    },
    questionBankQuestionService: {
      findFirstByQuestionId: jest.fn(),
      assignQuestionToBank: jest.fn(),
      update: jest.fn(),
    },
    uploadService: {
      deleteFileByPath: jest.fn(),
    },
  };
}

function createService(
  deps: ReturnType<typeof createServiceDependencies>,
): QuestionService {
  return new QuestionService(
    deps.questionRepo as any,
    deps.answerRepo as any,
    deps.questionBankService as any,
    deps.questionBankQuestionService as any,
    deps.uploadService as any,
  );
}
