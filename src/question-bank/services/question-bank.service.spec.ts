import { QuestionBankService } from './question-bank.service';

describe('QuestionBankService', () => {
  it('removes linked questions before deleting the question bank', async () => {
    const deps = createServiceDependencies();
    deps.questionBankRepo.findOne.mockResolvedValue({
      id: 'bank-1',
    });
    deps.questionBankQuestionRepo.find.mockResolvedValue([
      { questionId: 'question-1' },
      { questionId: 'question-2' },
      { questionId: 'question-1' },
    ]);
    const service = createService(deps);

    await service.remove('bank-1');

    expect(deps.questionService.remove).toHaveBeenCalledTimes(2);
    expect(deps.questionService.remove).toHaveBeenNthCalledWith(1, 'question-1');
    expect(deps.questionService.remove).toHaveBeenNthCalledWith(2, 'question-2');
    expect(deps.questionBankRepo.remove).toHaveBeenCalledWith({ id: 'bank-1' });
  });
});

function createServiceDependencies() {
  return {
    questionBankRepo: {
      findOne: jest.fn(),
      remove: jest.fn(),
    },
    questionBankQuestionRepo: {
      find: jest.fn(),
    },
    examSetRepo: {
      find: jest.fn(),
    },
    entityManager: {},
    classService: {
      findOne: jest.fn(),
    },
    questionBankImportService: {
      importExamFromPdf: jest.fn(),
    },
    questionService: {
      remove: jest.fn(),
      findOne: jest.fn(),
    },
  };
}

function createService(
  deps: ReturnType<typeof createServiceDependencies>,
): QuestionBankService {
  return new QuestionBankService(
    deps.questionBankRepo as any,
    deps.questionBankQuestionRepo as any,
    deps.examSetRepo as any,
    deps.entityManager as any,
    deps.classService as any,
    deps.questionBankImportService as any,
    deps.questionService as any,
  );
}
