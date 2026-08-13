import { AnswerEntity } from 'src/answer/answer.entity';
import { ContentTypes } from 'src/common/enum/content-type.enum';
import { QuestionEntity } from 'src/question/question.entity';
import { QuestionBankQuestionEntity } from 'src/question-bank-question/question-bank-question.entity';
import { QuestionBankSectionEntity } from 'src/question-bank-section/question-bank-section.entity';
import { QuestionBankEntity } from '../question-bank.entity';
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
    expect(deps.questionService.remove).toHaveBeenNthCalledWith(
      1,
      'question-1',
    );
    expect(deps.questionService.remove).toHaveBeenNthCalledWith(
      2,
      'question-2',
    );
    expect(deps.questionBankRepo.remove).toHaveBeenCalledWith({ id: 'bank-1' });
  });

  it('removes all linked question resources without deleting the question bank', async () => {
    const deps = createServiceDependencies();
    const questionBank = {
      id: 'bank-1',
      totalQuestions: 3,
    };
    deps.transactionQuestionBankRepo.findOne.mockResolvedValue(questionBank);
    deps.transactionLinkRepo.find.mockResolvedValue([
      { questionId: 'question-1' },
    ]);
    deps.transactionLinkRepo.count.mockResolvedValue(0);
    deps.transactionSectionRepo.find.mockResolvedValue([
      {
        meta: {
          audio: { path: '/uploads/question-banks/bank-1/audio.mp3' },
        },
      },
    ]);
    deps.transactionQuestionRepo.findOne.mockResolvedValueOnce({
      id: 'question-1',
      nextContent: 'question-2',
    });
    deps.transactionQuestionRepo.findOne.mockResolvedValueOnce({
      id: 'question-2',
      nextContent: null,
    });
    deps.transactionQuestionRepo.find.mockResolvedValue([
      {
        id: 'question-1',
        contentType: ContentTypes.IMAGE,
        content: '/uploads/question-image.png',
      },
    ]);
    deps.transactionAnswerRepo.find.mockResolvedValue([
      {
        contentType: ContentTypes.IMAGE,
        content: '/uploads/answer-image.png',
      },
    ]);
    const service = createService(deps);

    await service.removeResource('bank-1');

    expect(deps.queryRunner.commitTransaction).toHaveBeenCalledTimes(1);
    expect(deps.transactionLinkRepo.delete).toHaveBeenCalledWith({
      questionBankId: 'bank-1',
    });
    expect(deps.transactionSectionRepo.delete).toHaveBeenCalledWith({
      questionBankId: 'bank-1',
    });
    expect(deps.transactionQuestionRepo.delete).toHaveBeenCalled();
    expect(deps.transactionQuestionBankRepo.save).toHaveBeenCalledWith({
      id: 'bank-1',
      totalQuestions: 0,
    });
    expect(deps.uploadService.deleteFileByPath).toHaveBeenCalledWith(
      '/uploads/question-banks/bank-1/audio.mp3',
    );
    expect(deps.uploadService.deleteFileByPath).toHaveBeenCalledWith(
      '/uploads/question-image.png',
    );
    expect(deps.uploadService.deleteFileByPath).toHaveBeenCalledWith(
      '/uploads/answer-image.png',
    );
  });

  it('keeps questions referenced by another bank', async () => {
    const deps = createServiceDependencies();
    deps.transactionQuestionBankRepo.findOne.mockResolvedValue({
      id: 'bank-1',
      totalQuestions: 1,
    });
    deps.transactionLinkRepo.find.mockResolvedValue([
      { questionId: 'question-1' },
    ]);
    deps.transactionLinkRepo.count.mockResolvedValue(1);
    deps.transactionQuestionRepo.findOne.mockResolvedValue({
      id: 'question-1',
      nextContent: null,
    });
    const service = createService(deps);

    await service.removeResource('bank-1');

    expect(deps.transactionQuestionRepo.delete).not.toHaveBeenCalled();
    expect(deps.transactionLinkRepo.delete).toHaveBeenCalled();
    expect(deps.transactionSectionRepo.delete).toHaveBeenCalled();
  });

  it('does not delete physical files when the DB transaction rolls back', async () => {
    const deps = createServiceDependencies();
    deps.transactionQuestionBankRepo.findOne.mockResolvedValue({
      id: 'bank-1',
      totalQuestions: 1,
    });
    deps.transactionSectionRepo.find.mockResolvedValue([
      { meta: { audio: { path: '/uploads/audio.mp3' } } },
    ]);
    deps.transactionLinkRepo.delete.mockRejectedValue(new Error('DB failed'));
    const service = createService(deps);

    await expect(service.removeResource('bank-1')).rejects.toThrow('DB failed');

    expect(deps.queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(deps.uploadService.deleteFileByPath).not.toHaveBeenCalled();
  });

  it('skips only question ids supplied by the current room', async () => {
    const deps = createServiceDependencies();
    deps.questionBankRepo.findOne.mockResolvedValue({ id: 'bank-1' });
    deps.answerRepo.find.mockResolvedValue([]);

    const queryBuilder = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({
        id: 'question-2',
        isRoot: true,
        nextContent: null,
      }),
    };
    deps.questionRepo.createQueryBuilder.mockReturnValue(queryBuilder);

    const service = createService(deps);

    const question = await service.findRandomQuestion('bank-1', [
      'question-3',
      'question-3',
    ]);

    expect(question.id).toBe('question-2');
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'question.id NOT IN (:...excludeQuestionIds)',
      { excludeQuestionIds: ['question-3'] },
    );
  });
});

function createServiceDependencies() {
  const transactionQuestionBankRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
  };
  const transactionLinkRepo = {
    find: jest.fn().mockResolvedValue([]),
    count: jest.fn(),
    delete: jest.fn(),
  };
  const transactionSectionRepo = {
    find: jest.fn().mockResolvedValue([]),
    delete: jest.fn(),
  };
  const transactionQuestionRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
    delete: jest.fn(),
  };
  const transactionAnswerRepo = {
    find: jest.fn(),
  };
  const manager = {
    getRepository: jest.fn((entity) => {
      if (entity === QuestionBankEntity) return transactionQuestionBankRepo;
      if (entity === QuestionBankQuestionEntity) return transactionLinkRepo;
      if (entity === QuestionBankSectionEntity) return transactionSectionRepo;
      if (entity === QuestionEntity) return transactionQuestionRepo;
      if (entity === AnswerEntity) return transactionAnswerRepo;
      throw new Error('Unexpected repository');
    }),
  };
  const queryRunner = {
    manager,
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
  };

  return {
    transactionQuestionBankRepo,
    transactionLinkRepo,
    transactionSectionRepo,
    transactionQuestionRepo,
    transactionAnswerRepo,
    queryRunner,
    questionBankRepo: {
      findOne: jest.fn(),
      remove: jest.fn(),
      save: jest.fn(),
    },
    questionBankQuestionRepo: {
      find: jest.fn(),
    },
    questionRepo: {
      createQueryBuilder: jest.fn(),
      findOne: jest.fn(),
    },
    answerRepo: {
      find: jest.fn(),
      findOne: jest.fn(),
    },
    examSetRepo: {
      find: jest.fn(),
    },
    questionBankSectionRepo: {
      delete: jest.fn(),
    },
    entityManager: {
      getRepository: jest.fn(),
      connection: {
        createQueryRunner: jest.fn(() => queryRunner),
      },
    },
    classService: {
      findOne: jest.fn(),
    },
    questionBankImportService: {
      importExamFromPdf: jest.fn(),
    },
    questionBankZipImportService: {
      importExamFromZip: jest.fn(),
    },
    questionService: {
      remove: jest.fn(),
      findOne: jest.fn(),
    },
    uploadService: {
      deleteFileByPath: jest.fn().mockResolvedValue(true),
    },
  };
}

function createService(
  deps: ReturnType<typeof createServiceDependencies>,
): QuestionBankService {
  deps.entityManager.getRepository.mockReturnValue(
    deps.questionBankSectionRepo,
  );

  return new QuestionBankService(
    deps.questionBankRepo as any,
    deps.questionBankQuestionRepo as any,
    deps.questionRepo as any,
    deps.answerRepo as any,
    deps.examSetRepo as any,
    deps.entityManager as any,
    deps.classService as any,
    deps.questionBankImportService as any,
    deps.questionBankZipImportService as any,
    deps.questionService as any,
    deps.uploadService as any,
  );
}
