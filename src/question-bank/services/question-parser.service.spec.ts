import { ContentTypes } from 'src/common/enum/content-type.enum';
import { QuestionType } from 'src/question/enum/question-type.enum';
import { PdfParsingError } from '../exceptions/pdf-parsing.exception';
import { LayoutLine, PageContent } from '../types/question-bank-import.types';
import { QuestionParserService } from './question-parser.service';

describe('QuestionParserService', () => {
  let service: QuestionParserService;

  beforeEach(() => {
    service = new QuestionParserService();
  });

  it('parses a strict single-choice block and keeps stem/answer images on the correct side', async () => {
    const pageContent: PageContent = {
      pageNumber: 1,
      lines: [
        createTextLine(1, 0, 10, 'Cau 12. Chon dap an dung'),
        createImageLine(1, 1, 20, 'stem-image'),
        createTextLine(1, 2, 30, 'A.'),
        createImageLine(1, 3, 40, 'answer-a-image'),
        createTextLine(1, 4, 50, 'Noi dung A'),
        createTextLine(1, 5, 60, 'B. Noi dung B C. Noi dung C'),
      ],
    };

    const result = await service.parsePages([pageContent]);

    expect(result.questions).toHaveLength(1);
    expect(result.questions[0]).toMatchObject({
      number: 12,
      questionType: QuestionType.SINGLE_CHOICE,
      kind: 'single_choice',
      layoutKey: 'text_with_image_stem_mixed_answers',
    });
    expect(result.questions[0].stemParts).toEqual([
      { content: 'Chon dap an dung', contentType: ContentTypes.TEXT },
      { content: 'stem-image', contentType: ContentTypes.IMAGE },
    ]);
    expect(result.questions[0].answers).toEqual([
      {
        label: 'A',
        parts: [
          { content: 'answer-a-image', contentType: ContentTypes.IMAGE },
          { content: 'Noi dung A', contentType: ContentTypes.TEXT },
        ],
      },
      {
        label: 'B',
        parts: [{ content: 'Noi dung B', contentType: ContentTypes.TEXT }],
      },
      {
        label: 'C',
        parts: [{ content: 'Noi dung C', contentType: ContentTypes.TEXT }],
      },
    ]);
  });

  it('parses answer key sections after questions', async () => {
    const pageContent: PageContent = {
      pageNumber: 1,
      lines: [
        createTextLine(1, 0, 10, 'Cau 1. Chon dap an dung'),
        createTextLine(1, 1, 20, 'A. Dap an A B. Dap an B'),
        createTextLine(1, 2, 30, '* Dap an'),
        createTextLine(1, 3, 40, 'Cau 1: B'),
        createTextLine(1, 4, 50, '2. A'),
      ],
    };

    const result = await service.parsePages([pageContent]);

    expect(result.questions).toHaveLength(1);
    expect(result.answerKey).toEqual({
      1: 'B',
      2: 'A',
    });
  });

  it('splits inline answer key content from the question line', async () => {
    const pageContent: PageContent = {
      pageNumber: 1,
      lines: [
        createTextLine(
          1,
          0,
          10,
          'Cau 8. Truoc khi vao lop hoc online, Huy chuan bi vo but. Dap an: 1.C, 2.D, 8.B',
        ),
      ],
    };

    const result = await service.parsePages([pageContent]);

    expect(result.questions).toHaveLength(1);
    expect(result.questions[0]).toMatchObject({
      number: 8,
      questionType: QuestionType.TEXT_INPUT,
      kind: 'text_input',
    });
    expect(result.questions[0].stemParts).toEqual([
      {
        content: 'Truoc khi vao lop hoc online, Huy chuan bi vo but.',
        contentType: ContentTypes.TEXT,
      },
    ]);
    expect(result.answerKey).toEqual({
      1: 'C',
      2: 'D',
      8: 'B',
    });
  });

  it('classifies essay and matching prompts into different question kinds', async () => {
    const pages: PageContent[] = [
      {
        pageNumber: 1,
        lines: [
          createTextLine(1, 0, 10, 'Cau 1. Neu cam thay buon em se lam gi?'),
          createTextLine(1, 1, 20, 'Tra loi bang cach viet ngan gon.'),
          createTextLine(1, 2, 30, 'Cau 2. Em hay noi cot A voi cot B'),
          createTextLine(1, 3, 40, '1. Viec tot'),
          createTextLine(1, 4, 50, 'a. Ket qua tot'),
        ],
      },
    ];

    const result = await service.parsePages(pages);

    expect(result.questions).toHaveLength(2);
    expect(result.questions[0]).toMatchObject({
      number: 1,
      kind: 'text_input',
      questionType: QuestionType.TEXT_INPUT,
    });
    expect(result.questions[1]).toMatchObject({
      number: 2,
      kind: 'matching',
      questionType: QuestionType.MATCHING,
    });
  });

  it('rejects questions that skip answer labels', async () => {
    const pageContent: PageContent = {
      pageNumber: 1,
      lines: [
        createTextLine(1, 0, 10, 'Cau 3. Chon dap an dung'),
        createTextLine(1, 1, 20, 'A. Lua chon A'),
        createTextLine(1, 2, 30, 'C. Lua chon C'),
      ],
    };

    await expect(service.parsePages([pageContent])).rejects.toThrow(
      PdfParsingError,
    );
    await expect(service.parsePages([pageContent])).rejects.toThrow(
      'Answer labels must be sequential from A',
    );
  });

  it('reorders answers by label when pdf layout surfaces B and C before A', async () => {
    const pageContent: PageContent = {
      pageNumber: 2,
      lines: [
        createTextLine(2, 0, 10, 'Cau 4. Hanh dong nao the hien em yeu thuong gia dinh?'),
        createTextLine(
          2,
          1,
          20,
          'B. Gianh do choi voi em nho C. Bo di choi khong xin phep',
        ),
        createTextLine(2, 2, 30, 'A. Giup bo me viec nha'),
      ],
    };

    const result = await service.parsePages([pageContent]);

    expect(result.questions).toHaveLength(1);
    expect(result.questions[0].answers).toEqual([
      {
        label: 'A',
        parts: [{ content: 'Giup bo me viec nha', contentType: ContentTypes.TEXT }],
      },
      {
        label: 'B',
        parts: [
          { content: 'Gianh do choi voi em nho', contentType: ContentTypes.TEXT },
        ],
      },
      {
        label: 'C',
        parts: [
          { content: 'Bo di choi khong xin phep', contentType: ContentTypes.TEXT },
        ],
      },
    ]);
  });

  it('joins fragmented pdf text without injecting spaces inside words', async () => {
    const pageContent: PageContent = {
      pageNumber: 1,
      lines: [
        createTextFragmentsLine(1, 10, [
          { order: 0, x: 10, width: 42, content: 'Câu 2: T' },
          { order: 1, x: 52.2, width: 56, content: 'heo quy t' },
          { order: 2, x: 108.4, width: 5, content: 'ắ' },
          { order: 3, x: 113.7, width: 58, content: 'c 5 ngón tay' },
          {
            order: 4,
            x: 172.1,
            width: 140,
            content: ', ngón tay áp út tượng trưng cho ai?',
          },
        ]),
        createTextLine(1, 5, 20, 'A. Người thân'),
        createTextLine(1, 6, 30, 'B. Người quen'),
      ],
    };

    const result = await service.parsePages([pageContent]);

    expect(result.questions[0].stemParts).toEqual([
      {
        content: 'Theo quy tắc 5 ngón tay, ngón tay áp út tượng trưng cho ai?',
        contentType: ContentTypes.TEXT,
      },
    ]);
  });

  it('treats repeated labels on the active answer as fragmented content instead of duplicates', () => {
    const runtimeState: any = {
      currentQuestion: {
        number: 2,
        pageNumber: 2,
        stemParts: [],
        answers: [
          {
            label: 'A',
            parts: [{ content: 'Lua chon A', contentType: ContentTypes.TEXT }],
          },
          {
            label: 'B',
            parts: [{ content: 'Lua chon B', contentType: ContentTypes.TEXT }],
          },
          {
            label: 'C',
            parts: [{ content: 'Khong ro nguon goc.', contentType: ContentTypes.TEXT }],
          },
        ],
        currentAnswer: {
          label: 'C',
          parts: [{ content: 'Khong ro nguon goc.', contentType: ContentTypes.TEXT }],
        },
        pendingAnswerAnchors: [],
        pendingAnswerLastY: null,
      },
    };

    (service as any).startAnswer(runtimeState, 2, 'C', '');

    expect(runtimeState.currentQuestion.answers).toHaveLength(3);
    expect(runtimeState.currentQuestion.currentAnswer.label).toBe('C');
  });

  it('rejects answers that never receive text or image content', async () => {
    const pageContent: PageContent = {
      pageNumber: 1,
      lines: [
        createTextLine(1, 0, 10, 'Cau 4. Chon dap an dung'),
        createTextLine(1, 1, 20, 'A.'),
        createTextLine(1, 2, 30, 'B. Lua chon B'),
      ],
    };

    await expect(service.parsePages([pageContent])).rejects.toThrow(
      'Answer A must contain text or image content',
    );
  });

  it('assigns the image-only answer layout for text-plus-image stem questions', async () => {
    const pageContent: PageContent = {
      pageNumber: 1,
      lines: [
        createTextLine(1, 0, 10, 'Cau 8. Em hay giup Ro bot di chuyen den dich'),
        createImageLine(1, 1, 20, 'maze-image'),
        createTextLine(1, 2, 30, 'A.'),
        createImageLine(1, 3, 40, 'up-arrow'),
        createTextLine(1, 4, 50, 'B.'),
        createImageLine(1, 5, 60, 'right-arrow'),
        createTextLine(1, 6, 70, 'C.'),
        createImageLine(1, 7, 80, 'left-arrow'),
      ],
    };

    const result = await service.parsePages([pageContent]);

    expect(result.questions[0]).toMatchObject({
      number: 8,
      kind: 'single_choice',
      questionType: QuestionType.SINGLE_CHOICE,
      layoutKey: 'text_with_image_stem_image_only_answers',
    });
  });

  it('does not misclassify stems containing "noi" as matching', async () => {
    const pageContent: PageContent = {
      pageNumber: 1,
      lines: [
        createTextLine(1, 0, 10, 'Cau 1. Noi dung nao em khong nen xem?'),
        createTextLine(1, 1, 20, 'A. Video day ve tranh B. Bai hat thieu nhi'),
      ],
    };

    const result = await service.parsePages([pageContent]);

    expect(result.questions[0]).toMatchObject({
      number: 1,
      kind: 'single_choice',
      questionType: QuestionType.SINGLE_CHOICE,
    });
  });

  it('distributes image answers when labels A B C appear on the same line', async () => {
    const pageContent: PageContent = {
      pageNumber: 4,
      lines: [
        createTextLine(4, 0, 10, 'Cau 8. Em hay giup Ro bot di chuyen den dich'),
        createImageLine(4, 1, 20, 'maze-image'),
        createTextFragmentsLine(4, 30, [
          { order: 2, x: 80, content: 'A.' },
          { order: 3, x: 230, content: 'B.' },
          { order: 4, x: 380, content: 'C.' },
        ]),
        createImageFragmentsLine(4, 40, [
          { order: 5, x: 70, content: 'up-arrow' },
          { order: 6, x: 220, content: 'right-arrow' },
          { order: 7, x: 370, content: 'left-arrow' },
        ]),
      ],
    };

    const result = await service.parsePages([pageContent]);

    expect(result.questions[0].answers).toEqual([
      {
        label: 'A',
        parts: [{ content: 'up-arrow', contentType: ContentTypes.IMAGE }],
      },
      {
        label: 'B',
        parts: [{ content: 'right-arrow', contentType: ContentTypes.IMAGE }],
      },
      {
        label: 'C',
        parts: [{ content: 'left-arrow', contentType: ContentTypes.IMAGE }],
      },
    ]);
  });

  it('distributes image answers across consecutive image-only lines after a shared label line', async () => {
    const pageContent: PageContent = {
      pageNumber: 4,
      lines: [
        createTextLine(4, 0, 10, 'Cau 8. Em hay giup Ro bot di chuyen den dich'),
        createImageLine(4, 1, 20, 'maze-image'),
        createTextFragmentsLine(4, 30, [
          { order: 2, x: 80, content: 'A.' },
          { order: 3, x: 230, content: 'B.' },
          { order: 4, x: 380, content: 'C.' },
        ]),
        createImageLine(4, 5, 40, 'up-arrow'),
        createImageLine(4, 6, 50, 'right-arrow'),
        createImageLine(4, 7, 60, 'left-arrow'),
      ],
    };

    const result = await service.parsePages([pageContent]);

    expect(result.questions[0]).toMatchObject({
      layoutKey: 'text_with_image_stem_image_only_answers',
    });
    expect(result.questions[0].answers).toEqual([
      {
        label: 'A',
        parts: [{ content: 'up-arrow', contentType: ContentTypes.IMAGE }],
      },
      {
        label: 'B',
        parts: [{ content: 'right-arrow', contentType: ContentTypes.IMAGE }],
      },
      {
        label: 'C',
        parts: [{ content: 'left-arrow', contentType: ContentTypes.IMAGE }],
      },
    ]);
  });

  it('maps continuation text into the nearest answer column after a shared A B C row', async () => {
    const pageContent: PageContent = {
      pageNumber: 5,
      lines: [
        createTextLine(5, 0, 10, 'Cau 7. Hay chon hinh co hanh vi dung?'),
        createTextFragmentsLine(5, 20, [
          { order: 1, x: 80, width: 140, content: 'A. Su dung dien thoai qua' },
          { order: 2, x: 235, width: 145, content: 'B. Binh tinh tim loi thoat' },
          { order: 3, x: 390, width: 130, content: 'C. Tu y be canh, be hoa.' },
        ]),
        createTextFragmentsLine(5, 30, [
          { order: 4, x: 80, width: 35, content: 'nhieu.' },
          { order: 5, x: 235, width: 95, content: 'hiem khi co chay.' },
        ]),
      ],
    };

    const result = await service.parsePages([pageContent]);

    expect(result.questions[0].answers).toEqual([
      {
        label: 'A',
        parts: [
          {
            content: 'Su dung dien thoai qua nhieu.',
            contentType: ContentTypes.TEXT,
          },
        ],
      },
      {
        label: 'B',
        parts: [
          {
            content: 'Binh tinh tim loi thoat hiem khi co chay.',
            contentType: ContentTypes.TEXT,
          },
        ],
      },
      {
        label: 'C',
        parts: [{ content: 'Tu y be canh, be hoa.', contentType: ContentTypes.TEXT }],
      },
    ]);
  });

  it('does not split the trailing "a." in a normal word into a new A answer', async () => {
    const pageContent: PageContent = {
      pageNumber: 6,
      lines: [
        createTextLine(6, 0, 10, 'Cau 7. Hay chon hinh co hanh vi dung?'),
        createTextLine(6, 1, 20, 'A. Su dung dien thoai qua nhieu.'),
        createTextLine(6, 2, 30, 'B. Binh tinh tim loi thoat hiem khi co chay.'),
        createTextLine(6, 3, 40, 'C. Tu y be canh, be hoa.'),
      ],
    };

    const result = await service.parsePages([pageContent]);

    expect(result.questions).toHaveLength(1);
    expect(result.questions[0].answers).toEqual([
      {
        label: 'A',
        parts: [
          {
            content: 'Su dung dien thoai qua nhieu.',
            contentType: ContentTypes.TEXT,
          },
        ],
      },
      {
        label: 'B',
        parts: [
          {
            content: 'Binh tinh tim loi thoat hiem khi co chay.',
            contentType: ContentTypes.TEXT,
          },
        ],
      },
      {
        label: 'C',
        parts: [{ content: 'Tu y be canh, be hoa.', contentType: ContentTypes.TEXT }],
      },
    ]);
  });

  it('keeps question image on the stem and answer images under their matching text labels', async () => {
    const pageContent: PageContent = {
      pageNumber: 7,
      lines: [
        createTextLine(7, 0, 10, 'Cau 1. Chon dap an dung cho buc tranh'),
        createImageLine(7, 1, 20, 'question-image'),
        createTextLine(7, 2, 30, 'A. Dap an A'),
        createImageLine(7, 3, 40, 'answer-a-image'),
        createTextLine(7, 4, 50, 'B. Dap an B'),
        createImageLine(7, 5, 60, 'answer-b-image'),
        createTextLine(7, 6, 70, 'C. Dap an C'),
        createImageLine(7, 7, 80, 'answer-c-image'),
      ],
    };

    const result = await service.parsePages([pageContent]);

    expect(result.questions).toHaveLength(1);
    expect(result.questions[0]).toMatchObject({
      number: 1,
      kind: 'single_choice',
      questionType: QuestionType.SINGLE_CHOICE,
      layoutKey: 'text_with_image_stem_text_with_image_answers',
    });
    expect(result.questions[0].stemParts).toEqual([
      {
        content: 'Chon dap an dung cho buc tranh',
        contentType: ContentTypes.TEXT,
      },
      {
        content: 'question-image',
        contentType: ContentTypes.IMAGE,
      },
    ]);
    expect(result.questions[0].answers).toEqual([
      {
        label: 'A',
        parts: [
          { content: 'Dap an A', contentType: ContentTypes.TEXT },
          { content: 'answer-a-image', contentType: ContentTypes.IMAGE },
        ],
      },
      {
        label: 'B',
        parts: [
          { content: 'Dap an B', contentType: ContentTypes.TEXT },
          { content: 'answer-b-image', contentType: ContentTypes.IMAGE },
        ],
      },
      {
        label: 'C',
        parts: [
          { content: 'Dap an C', contentType: ContentTypes.TEXT },
          { content: 'answer-c-image', contentType: ContentTypes.IMAGE },
        ],
      },
    ]);
  });
});

function createTextLine(
  pageNumber: number,
  order: number,
  y: number,
  content: string,
): LayoutLine {
  return {
    y,
    x: 10,
    fragments: [
      {
        kind: 'text',
        content,
        x: 10,
        y,
        width: 100,
        height: 10,
        pageNumber,
        order,
      },
    ],
  };
}

function createImageLine(
  pageNumber: number,
  order: number,
  y: number,
  content: string,
): LayoutLine {
  return {
    y,
    x: 10,
    fragments: [
      {
        kind: 'image',
        content,
        x: 10,
        y,
        width: 40,
        height: 40,
        pageNumber,
        order,
      },
    ],
  };
}

function createTextFragmentsLine(
  pageNumber: number,
  y: number,
  fragments: Array<{
    order: number;
    x: number;
    content: string;
    width?: number;
  }>,
): LayoutLine {
  return {
    y,
    x: Math.min(...fragments.map((fragment) => fragment.x)),
    fragments: fragments.map((fragment) => ({
      kind: 'text' as const,
      content: fragment.content,
      x: fragment.x,
      y,
      width: fragment.width ?? 20,
      height: 10,
      pageNumber,
      order: fragment.order,
    })),
  };
}

function createImageFragmentsLine(
  pageNumber: number,
  y: number,
  fragments: Array<{ order: number; x: number; content: string }>,
): LayoutLine {
  return {
    y,
    x: Math.min(...fragments.map((fragment) => fragment.x)),
    fragments: fragments.map((fragment) => ({
      kind: 'image' as const,
      content: fragment.content,
      x: fragment.x,
      y,
      width: 40,
      height: 40,
      pageNumber,
      order: fragment.order,
    })),
  };
}
