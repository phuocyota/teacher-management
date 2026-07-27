import { BadRequestException } from '@nestjs/common';
import { ContentTypes } from 'src/common/enum/content-type.enum';
import { QuestionType } from 'src/question/enum/question-type.enum';
import {
  PageContent,
  ParsedDocumentResult,
  ParsedQuestionBlock,
} from '../types/question-bank-import.types';
import { QuestionBankImportService } from './question-bank-import.service';

describe('QuestionBankImportService', () => {
  it('uploads image parts and stores the uploaded path in persisted answers', async () => {
    const deps = createServiceDependencies();
    deps.questionService.createBulk.mockResolvedValue([
      {
        id: 'question-1',
        content: 'Question root',
        contentType: ContentTypes.TEXT,
        type: QuestionType.SINGLE_CHOICE,
      },
    ]);
    deps.answerService.createBulk.mockResolvedValue([{ id: 'answer-1' }]);
    deps.uploadService.saveBufferAsFile.mockResolvedValue({
      path: '/uploads/question-banks/question-bank-1/image-1.png',
    });
    const service = createService(deps);
    const createdQuestions: Array<{
      id: string;
      content: string;
      type: QuestionType;
      contentType: ContentTypes;
      answerCount: number;
    }> = [];

    await (service as any).persistQuestionBlock(
      'question-bank-1',
      createParsedQuestionBlock({
        answers: [
          {
            label: 'A',
            parts: [
              { content: 'iVBORw0KGgo=', contentType: ContentTypes.IMAGE },
            ],
          },
        ],
      }),
      createdQuestions,
      {},
    );

    expect(deps.uploadService.saveBufferAsFile).toHaveBeenCalledWith(
      expect.any(Buffer),
      expect.objectContaining({
        originalName: expect.stringContaining('pdf-image-'),
        mimetype: 'image/png',
        uploadedBy: 'pdf-import',
        folderPath: 'question-banks/question-bank-1',
        storedPathPrefix: '/uploads',
      }),
    );
    expect(deps.answerService.createBulk).toHaveBeenCalledWith([
      expect.objectContaining({
        questionId: 'question-1',
        content: '/uploads/question-banks/question-bank-1/image-1.png',
        contentType: ContentTypes.IMAGE,
        meta: { importOptionLabel: 'A' },
      }),
    ]);
  });

  it('marks only the first stem part as root when persisting chained question content', async () => {
    const deps = createServiceDependencies();
    deps.questionService.createBulk.mockResolvedValue([
      {
        id: 'question-1',
        content: 'Part 1',
        contentType: ContentTypes.TEXT,
        type: QuestionType.TEXT_INPUT,
        isRoot: true,
      },
      {
        id: 'question-2',
        content: 'Part 2',
        contentType: ContentTypes.TEXT,
        type: QuestionType.TEXT_INPUT,
        isRoot: false,
      },
    ]);
    const service = createService(deps);

    await (service as any).persistQuestionBlock(
      'question-bank-1',
      createParsedQuestionBlock({
        questionType: QuestionType.TEXT_INPUT,
        kind: 'text_input',
        stemParts: [
          { content: 'Part 1', contentType: ContentTypes.TEXT },
          { content: 'Part 2', contentType: ContentTypes.TEXT },
        ],
        answers: [],
      }),
      [],
      {},
    );

    expect(deps.questionService.createBulk).toHaveBeenCalledWith([
      {
        type: QuestionType.TEXT_INPUT,
        content: 'Part 1',
        contentType: ContentTypes.TEXT,
        isRoot: true,
      },
      {
        type: QuestionType.TEXT_INPUT,
        content: 'Part 2',
        contentType: ContentTypes.TEXT,
        isRoot: false,
      },
    ]);
  });

  it('uses the provided per-question score when linking imported questions', async () => {
    const deps = createServiceDependencies();
    deps.questionService.createBulk.mockResolvedValue([
      {
        id: 'question-1',
        content: 'Question root',
        contentType: ContentTypes.TEXT,
        type: QuestionType.SINGLE_CHOICE,
      },
    ]);
    deps.answerService.createBulk.mockResolvedValue([{ id: 'answer-1' }]);
    const service = createService(deps);

    await (service as any).persistQuestionBlock(
      'question-bank-1',
      createParsedQuestionBlock(),
      [],
      {},
      0.5,
    );

    expect(deps.questionBankQuestionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        questionBankId: 'question-bank-1',
        questionId: 'question-1',
        orderNo: 1,
        points: 0.5,
      }),
    );
  });

  it('keeps totalMarks as the single score source when importing questions', async () => {
    const deps = createServiceDependencies();
    const questionBank = {
      id: 'question-bank-1',
      totalQuestions: 0,
      totalMarks: 10,
    };
    deps.questionBankRepo.findOne.mockResolvedValue(questionBank);
    deps.questionBankQuestionRepo.count.mockResolvedValue(2);
    deps.questionService.createBulk
      .mockResolvedValueOnce([
        {
          id: 'question-1',
          content: 'Question 1',
          contentType: ContentTypes.TEXT,
          type: QuestionType.SINGLE_CHOICE,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'question-2',
          content: 'Question 2',
          contentType: ContentTypes.TEXT,
          type: QuestionType.SINGLE_CHOICE,
        },
      ]);
    deps.answerService.createBulk.mockResolvedValue([{ id: 'answer-1' }]);
    deps.questionParser.parsePages.mockResolvedValue({
      questions: [
        createParsedQuestionBlock({
          number: 1,
          stemParts: [
            { content: 'Question 1', contentType: ContentTypes.TEXT },
          ],
        }),
        createParsedQuestionBlock({
          number: 2,
          stemParts: [
            { content: 'Question 2', contentType: ContentTypes.TEXT },
          ],
        }),
      ],
      answerKey: {},
    } satisfies ParsedDocumentResult);
    const service = createService(deps);
    jest
      .spyOn(service as any, 'readPdfPages')
      .mockResolvedValue([createPage(1, ['Cau 1. Question 1'])]);

    await service.importExamFromPdf('question-bank-1', Buffer.from('pdf'));

    expect(deps.questionBankRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        totalQuestions: 2,
        totalMarks: 10,
      }),
    );
  });

  it('persists parsed sections and links questions to their section', async () => {
    const deps = createServiceDependencies();
    deps.questionBankRepo.findOne.mockResolvedValue({
      id: 'question-bank-1',
      totalMarks: 10,
    });
    deps.questionBankQuestionRepo.count.mockResolvedValue(1);
    deps.questionService.createBulk.mockResolvedValue([
      {
        id: 'question-1',
        content: 'Question 1',
        contentType: ContentTypes.TEXT,
        type: QuestionType.SINGLE_CHOICE,
      },
    ]);
    deps.answerService.createBulk.mockResolvedValue([{ id: 'answer-1' }]);
    deps.questionParser.parsePages.mockResolvedValue({
      sections: [
        {
          orderNo: 1,
          title: 'PART I: VOCABULARY',
          instruction: 'Choose the best answer.',
        },
      ],
      questions: [
        createParsedQuestionBlock({
          sectionOrderNo: 1,
        }),
      ],
      answerKey: { 1: 'A' },
    } satisfies ParsedDocumentResult);
    const service = createService(deps);
    jest
      .spyOn(service as any, 'readPdfPages')
      .mockResolvedValue([createPage(1, ['PART I: VOCABULARY'])]);

    await service.importExamFromPdf('question-bank-1', Buffer.from('pdf'));

    expect(deps.questionBankSectionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        questionBankId: 'question-bank-1',
        title: 'PART I: VOCABULARY',
        instruction: 'Choose the best answer.',
        orderNo: 1,
      }),
    );
    expect(deps.questionBankQuestionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        questionBankId: 'question-bank-1',
        questionId: 'question-1',
        sectionId: 'section-1',
      }),
    );
  });

  it('filters repeated headers and footers without removing unique content', () => {
    const service = createService(createServiceDependencies());
    const filtered = (service as any).filterPageArtifacts([
      createPage(1, [
        'HEADER SHARED',
        'Cau 1. Noi dung trang 1',
        'A. Lua chon A',
        'FOOTER SHARED 1',
      ]),
      createPage(2, [
        'HEADER SHARED',
        'Cau 2. Noi dung trang 2',
        'B. Lua chon B',
        'FOOTER SHARED 2',
      ]),
      createPage(3, [
        'HEADER UNIQUE',
        'Cau 3. Noi dung trang 3',
        'C. Lua chon C',
        'FOOTER UNIQUE 3',
      ]),
    ]) as PageContent[];

    expect(filtered[0].lines.map((line) => line.fragments[0].content)).toEqual([
      'Cau 1. Noi dung trang 1',
      'A. Lua chon A',
    ]);
    expect(filtered[1].lines.map((line) => line.fragments[0].content)).toEqual([
      'Cau 2. Noi dung trang 2',
      'B. Lua chon B',
    ]);
    expect(filtered[2].lines.map((line) => line.fragments[0].content)).toEqual([
      'HEADER UNIQUE',
      'Cau 3. Noi dung trang 3',
      'C. Lua chon C',
      'FOOTER UNIQUE 3',
    ]);
  });

  it('removes compact inline answer key text from persisted answer content', async () => {
    const deps = createServiceDependencies();
    deps.questionService.createBulk.mockResolvedValue([
      {
        id: 'question-1',
        content: 'Question root',
        contentType: ContentTypes.TEXT,
        type: QuestionType.SINGLE_CHOICE,
      },
    ]);
    deps.answerService.createBulk.mockResolvedValue([{ id: 'answer-1' }]);
    const service = createService(deps);
    const answerKey: Record<number, 'A' | 'B' | 'C' | 'D'> = {};

    await (service as any).persistQuestionBlock(
      'question-bank-1',
      createParsedQuestionBlock({
        number: 10,
        answers: [
          {
            label: 'A',
            parts: [
              {
                content:
                  'Thiet ke theo trinh tu vi day la bai thuyet trinh nghiem tuc',
                contentType: ContentTypes.TEXT,
              },
            ],
          },
          {
            label: 'B',
            parts: [
              {
                content: 'Lua chon B Dap an: 1C, 2B, 10A',
                contentType: ContentTypes.TEXT,
              },
            ],
          },
        ],
      }),
      [],
      answerKey,
    );

    expect(deps.answerService.createBulk).toHaveBeenNthCalledWith(2, [
      expect.objectContaining({
        content: 'Lua chon B',
        contentType: ContentTypes.TEXT,
        meta: { importOptionLabel: 'B' },
      }),
    ]);
    expect(answerKey).toEqual({
      1: 'C',
      2: 'B',
      10: 'A',
    });
  });

  it('does not treat answer anchor lines above image-only answers as repeated footers', () => {
    const service = createService(createServiceDependencies());
    const filtered = (service as any).filterPageArtifacts([
      createMixedPage(5, [
        createTextLine(5, 0, 'HEADER SHARED'),
        createTextLine(5, 1, 'Cau 9. Noi dung trang 5'),
        createTextLine(5, 2, 'A.'),
        createTextLine(5, 3, 'B.'),
        createImageLine(5, 4, 'answer-a-image'),
        createImageLine(5, 5, 'answer-b-image'),
      ]),
      createMixedPage(6, [
        createTextLine(6, 0, 'HEADER SHARED'),
        createTextLine(6, 1, 'Cau 10. Noi dung trang 6'),
        createTextLine(6, 2, 'A.'),
        createTextLine(6, 3, 'B.'),
        createImageLine(6, 4, 'answer-a-image'),
        createImageLine(6, 5, 'answer-b-image'),
      ]),
    ]) as PageContent[];

    expect(filtered[0].lines.map((line) => line.fragments[0].content)).toEqual([
      'Cau 9. Noi dung trang 5',
      'A.',
      'B.',
      'answer-a-image',
      'answer-b-image',
    ]);
    expect(filtered[1].lines.map((line) => line.fragments[0].content)).toEqual([
      'Cau 10. Noi dung trang 6',
      'A.',
      'B.',
      'answer-a-image',
      'answer-b-image',
    ]);
  });

  it('fails before persistence when a recognized but unsupported question type is detected', async () => {
    const deps = createServiceDependencies();
    deps.questionBankRepo.findOne.mockResolvedValue({
      id: 'question-bank-1',
      totalQuestions: 0,
    });
    deps.questionParser.parsePages.mockResolvedValue({
      questions: [
        createParsedQuestionBlock({
          number: 9,
          kind: 'matching',
          questionType: QuestionType.MATCHING,
          answers: [],
        }),
      ],
      answerKey: {},
    } satisfies ParsedDocumentResult);
    const service = createService(deps);
    jest
      .spyOn(service as any, 'readPdfPages')
      .mockResolvedValue([
        createPage(1, ['Cau 9. Em hay noi cot A voi cot B']),
      ]);

    await expect(
      service.importExamFromPdf('question-bank-1', Buffer.from('pdf')),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.importExamFromPdf('question-bank-1', Buffer.from('pdf')),
    ).rejects.toThrow(
      'Question type "matching" is recognized but not supported by this import flow [Page 1] {questionNumber: 9}',
    );
    expect(deps.questionService.createBulk).not.toHaveBeenCalled();
    expect(deps.answerService.createBulk).not.toHaveBeenCalled();
    expect(deps.questionBankQuestionRepo.count).not.toHaveBeenCalled();
  });
});

function createServiceDependencies() {
  return {
    questionBankRepo: {
      findOne: jest.fn(),
      save: jest.fn(),
    },
    questionBankQuestionRepo: {
      create: jest.fn((value) => value),
      save: jest.fn(),
      count: jest.fn(),
    },
    questionBankSectionRepo: {
      findOne: jest.fn(),
      create: jest.fn((value) => ({
        id: `section-${value.orderNo}`,
        ...value,
      })),
      save: jest.fn((value) => Promise.resolve(value)),
    },
    questionService: {
      createBulk: jest.fn(),
      updateBulk: jest.fn().mockResolvedValue([]),
    },
    answerService: {
      createBulk: jest.fn(),
      updateBulk: jest.fn().mockResolvedValue([]),
    },
    pdfImageExtractor: {
      extractPageImages: jest.fn(),
    },
    questionParser: {
      parsePages: jest.fn(),
    },
    uploadService: {
      saveBufferAsFile: jest.fn(),
    },
  };
}

function createService(
  deps: ReturnType<typeof createServiceDependencies>,
): QuestionBankImportService {
  return new QuestionBankImportService(
    deps.questionBankRepo as any,
    deps.questionBankQuestionRepo as any,
    deps.questionBankSectionRepo as any,
    deps.questionService as any,
    deps.answerService as any,
    deps.pdfImageExtractor as any,
    deps.questionParser as any,
    deps.uploadService as any,
  );
}

function createParsedQuestionBlock(
  overrides: Partial<ParsedQuestionBlock> = {},
): ParsedQuestionBlock {
  return {
    number: 1,
    pageNumber: 1,
    stemParts: [{ content: 'Question root', contentType: ContentTypes.TEXT }],
    answers: [
      {
        label: 'A',
        parts: [{ content: 'Lua chon A', contentType: ContentTypes.TEXT }],
      },
      {
        label: 'B',
        parts: [{ content: 'Lua chon B', contentType: ContentTypes.TEXT }],
      },
    ],
    kind: 'single_choice',
    questionType: QuestionType.SINGLE_CHOICE,
    ...overrides,
  };
}

function createPage(pageNumber: number, textLines: string[]): PageContent {
  return {
    pageNumber,
    lines: textLines.map((content, index) => ({
      y: (index + 1) * 10,
      x: 10,
      fragments: [
        {
          kind: 'text' as const,
          content,
          x: 10,
          y: (index + 1) * 10,
          width: 100,
          height: 10,
          pageNumber,
          order: index,
        },
      ],
    })),
  };
}

function createMixedPage(
  pageNumber: number,
  lines: PageContent['lines'],
): PageContent {
  return {
    pageNumber,
    lines,
  };
}

function createTextLine(pageNumber: number, order: number, content: string) {
  return {
    y: (order + 1) * 10,
    x: 10,
    fragments: [
      {
        kind: 'text' as const,
        content,
        x: 10,
        y: (order + 1) * 10,
        width: 100,
        height: 10,
        pageNumber,
        order,
      },
    ],
  };
}

function createImageLine(pageNumber: number, order: number, content: string) {
  return {
    y: (order + 1) * 10,
    x: 10,
    fragments: [
      {
        kind: 'image' as const,
        content,
        x: 10,
        y: (order + 1) * 10,
        width: 100,
        height: 10,
        pageNumber,
        order,
      },
    ],
  };
}
