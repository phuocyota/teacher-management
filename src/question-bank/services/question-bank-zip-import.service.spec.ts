/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/require-await */
import { ContentTypes } from 'src/common/enum/content-type.enum';
import { QuestionType } from 'src/question/enum/question-type.enum';
import { QuestionBankZipImportService } from './question-bank-zip-import.service';

describe('QuestionBankZipImportService', () => {
  it('rolls back DB and removes newly written files when replacement fails', async () => {
    const deps = dependencies();
    const service = createService(deps);
    jest
      .spyOn(service as any, 'replaceResources')
      .mockImplementation(
        async (
          _manager: unknown,
          _bankId: string,
          _document: unknown,
          _sections: unknown,
          _audio: unknown,
          newPaths: string[],
        ) => {
          newPaths.push('/uploads/question-banks/bank/new.mp3');
          throw new Error('persist failed');
        },
      );

    await expect(
      service.importExamFromZip('bank', Buffer.from('zip')),
    ).rejects.toThrow('persist failed');

    expect(deps.queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(deps.queryRunner.commitTransaction).not.toHaveBeenCalled();
    expect(deps.uploadService.deleteFileByPath).toHaveBeenCalledWith(
      '/uploads/question-banks/bank/new.mp3',
    );
  });

  it('rejects a missing listening audio before opening a transaction', async () => {
    const deps = dependencies();
    deps.structuredParser.parsePages.mockResolvedValue({
      document: validDocument(),
      sections: [
        {
          orderNo: 1,
          title: 'NHÓM Câu 1-1',
          meta: {
            questionFormat: 'LISTENING',
            questionRange: { from: 1, to: 1 },
            audio: { label: 'Audio 001' },
          },
        },
      ],
    });
    const service = createService(deps);

    await expect(
      service.importExamFromZip('bank', Buffer.from('zip')),
    ).rejects.toThrow('Không tìm thấy file audio');
    expect(deps.connection.createQueryRunner).not.toHaveBeenCalled();
  });

  it('commits replacement and performs old-file cleanup after commit', async () => {
    const deps = dependencies();
    const service = createService(deps);
    jest
      .spyOn(service as any, 'replaceResources')
      .mockImplementation(
        async (
          _manager: unknown,
          _bankId: string,
          _document: unknown,
          _sections: unknown,
          _audio: unknown,
          _newPaths: string[],
          oldPaths: string[],
        ) => {
          oldPaths.push('/uploads/question-banks/bank/old.mp3');
          return {
            totalQuestions: 1,
            totalAnswers: 4,
            questions: [],
            answerKey: { '1': 'A' },
            sections: [],
            audioFiles: [],
          };
        },
      );

    await service.importExamFromZip('bank', Buffer.from('zip'));

    expect(deps.queryRunner.commitTransaction).toHaveBeenCalledTimes(1);
    expect(deps.queryRunner.rollbackTransaction).not.toHaveBeenCalled();
    expect(deps.uploadService.deleteFileByPath).toHaveBeenCalledWith(
      '/uploads/question-banks/bank/old.mp3',
    );
  });
});

function validDocument() {
  return {
    questions: [
      {
        number: 1,
        pageNumber: 1,
        sectionOrderNo: 1,
        stemParts: [{ content: 'Question', contentType: ContentTypes.TEXT }],
        answers: ['A', 'B', 'C', 'D'].map((label) => ({
          label,
          parts: [{ content: label, contentType: ContentTypes.TEXT }],
        })),
        kind: 'single_choice',
        questionType: QuestionType.SINGLE_CHOICE,
      },
    ],
    answerKey: { 1: 'A' },
  } as any;
}

function dependencies() {
  const queryRunner = {
    manager: {},
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
  };
  const connection = { createQueryRunner: jest.fn(() => queryRunner) };
  return {
    queryRunner,
    connection,
    questionBankRepo: {
      findOne: jest.fn().mockResolvedValue({ id: 'bank', totalMarks: 10 }),
    },
    entityManager: { connection },
    zipReader: {
      inspect: jest.fn().mockResolvedValue({
        pdf: { buffer: Buffer.from('%PDF-test') },
        audioFiles: [],
        warnings: [],
      }),
      normalizeAudioLabel: jest.fn((value: string) => value.toLowerCase()),
    },
    pdfImportService: {
      readRawPdfPages: jest.fn().mockResolvedValue([]),
    },
    structuredParser: {
      parsePages: jest.fn().mockResolvedValue({
        document: validDocument(),
        sections: [
          {
            orderNo: 1,
            title: 'NHÓM Câu 1-1',
            meta: {
              questionFormat: 'READING',
              questionRange: { from: 1, to: 1 },
            },
          },
        ],
      }),
    },
    uploadService: {
      deleteFileByPath: jest.fn().mockResolvedValue(true),
    },
  };
}

function createService(deps: ReturnType<typeof dependencies>) {
  return new QuestionBankZipImportService(
    deps.questionBankRepo as any,
    deps.entityManager as any,
    deps.zipReader as any,
    deps.pdfImportService as any,
    deps.structuredParser as any,
    deps.uploadService as any,
  );
}
