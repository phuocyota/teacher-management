import { ContentTypes } from 'src/common/enum/content-type.enum';
import { PageContent } from '../types/question-bank-import.types';
import { QuestionParserService } from './question-parser.service';

describe('QuestionParserService', () => {
  let service: QuestionParserService;

  beforeEach(() => {
    service = new QuestionParserService();
  });

  it('parses numbered questions and splits multiple answers on the same line', async () => {
    const pageContent: PageContent = {
      pageNumber: 1,
      lines: [
        {
          y: 10,
          x: 10,
          fragments: [
            {
              kind: 'text',
              content: '1. I have a ___.',
              x: 10,
              y: 10,
              width: 50,
              height: 10,
              pageNumber: 1,
              order: 0,
            },
          ],
        },
        {
          y: 20,
          x: 10,
          fragments: [
            {
              kind: 'text',
              content: 'A. cat B. pen C. book D. bag',
              x: 10,
              y: 20,
              width: 50,
              height: 10,
              pageNumber: 1,
              order: 1,
            },
          ],
        },
        {
          y: 30,
          x: 10,
          fragments: [
            {
              kind: 'text',
              content: '2. This is my ___.',
              x: 10,
              y: 30,
              width: 50,
              height: 10,
              pageNumber: 1,
              order: 2,
            },
          ],
        },
      ],
    };

    const result = await service.processPageContent(pageContent, null);

    expect(result.completedQuestions).toHaveLength(1);
    expect(result.completedQuestions[0].number).toBe(1);
    expect(result.completedQuestions[0].questionParts).toEqual([
      { content: 'I have a ___.', contentType: ContentTypes.TEXT },
    ]);
    expect(result.completedQuestions[0].answerPartsList).toHaveLength(4);
    expect(
      result.completedQuestions[0].answerPartsList.map((parts) => parts[0].content),
    ).toEqual(['cat', 'pen', 'book', 'bag']);
    expect(result.parserState.currentQuestion?.number).toBe(2);
    expect(result.parserState.currentQuestion?.questionParts).toEqual([
      { content: 'This is my ___.', contentType: ContentTypes.TEXT },
    ]);
  });

  it('buffers images before answer labels so they can be attached to choices', async () => {
    const pageContent: PageContent = {
      pageNumber: 1,
      lines: [
        {
          y: 10,
          x: 10,
          fragments: [
            {
              kind: 'text',
              content: '11.',
              x: 10,
              y: 10,
              width: 20,
              height: 10,
              pageNumber: 1,
              order: 0,
            },
          ],
        },
        {
          y: 20,
          x: 10,
          fragments: [
            {
              kind: 'image',
              content: 'base64-image',
              x: 10,
              y: 20,
              width: 20,
              height: 20,
              pageNumber: 1,
              order: 1,
            },
          ],
        },
      ],
    };

    const result = await service.processPageContent(pageContent, null);

    expect(result.completedQuestions).toHaveLength(0);
    expect(result.parserState.currentQuestion?.number).toBe(11);
    expect(result.parserState.currentQuestion?.questionParts).toEqual([]);
    expect(result.parserState.currentQuestion?.pendingAnswerMedia).toEqual([
      { content: 'base64-image', contentType: ContentTypes.IMAGE },
    ]);
  });

  it('attaches buffered images to each answer when answer labels appear', async () => {
    const pageContent: PageContent = {
      pageNumber: 1,
      lines: [
        {
          y: 10,
          x: 10,
          fragments: [
            {
              kind: 'text',
              content: 'C\u00e2u 12. Chon dap an dung',
              x: 10,
              y: 10,
              width: 80,
              height: 10,
              pageNumber: 1,
              order: 0,
            },
          ],
        },
        {
          y: 20,
          x: 10,
          fragments: [
            {
              kind: 'image',
              content: 'image-a',
              x: 10,
              y: 20,
              width: 20,
              height: 20,
              pageNumber: 1,
              order: 1,
            },
            {
              kind: 'image',
              content: 'image-b',
              x: 40,
              y: 20,
              width: 20,
              height: 20,
              pageNumber: 1,
              order: 2,
            },
            {
              kind: 'image',
              content: 'image-c',
              x: 70,
              y: 20,
              width: 20,
              height: 20,
              pageNumber: 1,
              order: 3,
            },
          ],
        },
        {
          y: 30,
          x: 10,
          fragments: [
            {
              kind: 'text',
              content: 'A. Lua chon A B. Lua chon B C. Lua chon C',
              x: 10,
              y: 30,
              width: 120,
              height: 10,
              pageNumber: 1,
              order: 4,
            },
          ],
        },
      ],
    };

    const result = await service.processPageContent(pageContent, null);

    expect(result.parserState.currentQuestion?.answerPartsList).toHaveLength(3);
    expect(
      result.parserState.currentQuestion?.answerPartsList.map((parts) =>
        parts.map((part) => part.contentType),
      ),
    ).toEqual([
      [ContentTypes.IMAGE, ContentTypes.TEXT],
      [ContentTypes.IMAGE, ContentTypes.TEXT],
      [ContentTypes.IMAGE, ContentTypes.TEXT],
    ]);
    expect(
      result.parserState.currentQuestion?.answerPartsList.map((parts) =>
        parts.map((part) => part.content),
      ),
    ).toEqual([
      ['image-a', 'Lua chon A'],
      ['image-b', 'Lua chon B'],
      ['image-c', 'Lua chon C'],
    ]);
  });

  it('switches to answer_key mode when it sees the answer section', async () => {
    const pageContent: PageContent = {
      pageNumber: 1,
      lines: [
        {
          y: 10,
          x: 10,
          fragments: [
            {
              kind: 'text',
              content: 'C\u00e2u 1. Chon dap an dung',
              x: 10,
              y: 10,
              width: 80,
              height: 10,
              pageNumber: 1,
              order: 0,
            },
          ],
        },
        {
          y: 20,
          x: 10,
          fragments: [
            {
              kind: 'text',
              content: 'A. Dap an A B. Dap an B',
              x: 10,
              y: 20,
              width: 80,
              height: 10,
              pageNumber: 1,
              order: 1,
            },
          ],
        },
        {
          y: 30,
          x: 10,
          fragments: [
            {
              kind: 'text',
              content: '* \u0110\u00e1p \u00e1n',
              x: 10,
              y: 30,
              width: 40,
              height: 10,
              pageNumber: 1,
              order: 2,
            },
          ],
        },
        {
          y: 40,
          x: 10,
          fragments: [
            {
              kind: 'text',
              content: 'C\u00e2u 1: B',
              x: 10,
              y: 40,
              width: 40,
              height: 10,
              pageNumber: 1,
              order: 3,
            },
          ],
        },
        {
          y: 50,
          x: 10,
          fragments: [
            {
              kind: 'text',
              content: 'C\u00e2u 2. C',
              x: 10,
              y: 50,
              width: 40,
              height: 10,
              pageNumber: 1,
              order: 4,
            },
          ],
        },
        {
          y: 60,
          x: 10,
          fragments: [
            {
              kind: 'text',
              content: 'C\u00e2u 3. Khong duoc parse thanh cau hoi moi',
              x: 10,
              y: 60,
              width: 120,
              height: 10,
              pageNumber: 1,
              order: 5,
            },
          ],
        },
      ],
    };

    const result = await service.processPageContent(pageContent, null);

    expect(result.completedQuestions).toHaveLength(1);
    expect(result.completedQuestions[0].number).toBe(1);
    expect(result.completedQuestions[0].answerPartsList).toHaveLength(2);
    expect(result.parserState.mode).toBe('answer_key');
    expect(result.parserState.currentQuestion).toBeNull();
    expect(result.parserState.answerKey).toEqual({
      1: 'B',
      2: 'C',
    });
  });

  it('splits answer labels even when there is whitespace before the dot', async () => {
    const pageContent: PageContent = {
      pageNumber: 1,
      lines: [
        {
          y: 10,
          x: 10,
          fragments: [
            {
              kind: 'text',
              content: 'C\u00e2u 6. Khi muon nho giup do, em nen:',
              x: 10,
              y: 10,
              width: 80,
              height: 10,
              pageNumber: 1,
              order: 0,
            },
          ],
        },
        {
          y: 20,
          x: 10,
          fragments: [
            {
              kind: 'text',
              content: 'A. Khoc to B . Noi ro rang C. Danh nhau',
              x: 10,
              y: 20,
              width: 120,
              height: 10,
              pageNumber: 1,
              order: 1,
            },
          ],
        },
      ],
    };

    const result = await service.processPageContent(pageContent, null);

    expect(result.parserState.currentQuestion?.answerPartsList).toHaveLength(3);
    expect(
      result.parserState.currentQuestion?.answerPartsList.map(
        (parts) => parts[0].content,
      ),
    ).toEqual(['Khoc to', 'Noi ro rang', 'Danh nhau']);
  });

  it('recognizes common English question prefixes and lowercase answer labels', async () => {
    const pageContent: PageContent = {
      pageNumber: 1,
      lines: [
        {
          y: 10,
          x: 10,
          fragments: [
            {
              kind: 'text',
              content: 'Question 7 - Choose the correct answer',
              x: 10,
              y: 10,
              width: 120,
              height: 10,
              pageNumber: 1,
              order: 0,
            },
          ],
        },
        {
          y: 20,
          x: 10,
          fragments: [
            {
              kind: 'text',
              content: 'a) First option b: Second option',
              x: 10,
              y: 20,
              width: 120,
              height: 10,
              pageNumber: 1,
              order: 1,
            },
          ],
        },
      ],
    };

    const result = await service.processPageContent(pageContent, null);

    expect(result.parserState.currentQuestion?.number).toBe(7);
    expect(result.parserState.currentQuestion?.questionParts).toEqual([
      { content: 'Choose the correct answer', contentType: ContentTypes.TEXT },
    ]);
    expect(result.parserState.currentQuestion?.answerPartsList).toHaveLength(2);
    expect(
      result.parserState.currentQuestion?.answerPartsList.map(
        (parts) => parts[0].content,
      ),
    ).toEqual(['First option', 'Second option']);
  });

  it('ignores repeated headers and footers while parsing question content', async () => {
    const pageContent: PageContent = {
      pageNumber: 2,
      lines: [
        {
          y: 10,
          x: 10,
          fragments: [
            {
              kind: 'text',
              content: 'C\u00e2u 3. Noi dung cau hoi',
              x: 10,
              y: 10,
              width: 80,
              height: 10,
              pageNumber: 2,
              order: 0,
            },
          ],
        },
        {
          y: 15,
          x: 10,
          fragments: [
            {
              kind: 'text',
              content: '2',
              x: 10,
              y: 15,
              width: 20,
              height: 10,
              pageNumber: 2,
              order: 1,
            },
          ],
        },
        {
          y: 20,
          x: 10,
          fragments: [
            {
              kind: 'text',
              content: 'Kh\u1ed1i 1 . \u0110\u1ec1 ki\u1ec3m tra h\u1ecdc k\u00ec II 2',
              x: 10,
              y: 20,
              width: 90,
              height: 10,
              pageNumber: 2,
              order: 2,
            },
          ],
        },
        {
          y: 30,
          x: 10,
          fragments: [
            {
              kind: 'text',
              content:
                'CH\u01af\u01a0NG TR\u00ccNH GI\u00c1O D\u1ee4C K\u1ef8 N\u0102NG S\u1ed0NG _ ICHISKILL',
              x: 10,
              y: 30,
              width: 140,
              height: 10,
              pageNumber: 2,
              order: 3,
            },
          ],
        },
        {
          y: 40,
          x: 10,
          fragments: [
            {
              kind: 'text',
              content: 'A. Lua chon 1 B. Lua chon 2',
              x: 10,
              y: 40,
              width: 100,
              height: 10,
              pageNumber: 2,
              order: 4,
            },
          ],
        },
      ],
    };

    const result = await service.processPageContent(pageContent, null);

    expect(result.parserState.currentQuestion?.questionParts).toEqual([
      { content: 'Noi dung cau hoi', contentType: ContentTypes.TEXT },
    ]);
    expect(
      result.parserState.currentQuestion?.answerPartsList.map(
        (parts) => parts[0].content,
      ),
    ).toEqual(['Lua chon 1', 'Lua chon 2']);
  });

  it('ignores standalone figure labels inside answer blocks', async () => {
    const pageContent: PageContent = {
      pageNumber: 2,
      lines: [
        {
          y: 10,
          x: 10,
          fragments: [
            {
              kind: 'text',
              content: 'C\u00e2u 3. Chon hinh dung',
              x: 10,
              y: 10,
              width: 80,
              height: 10,
              pageNumber: 2,
              order: 0,
            },
          ],
        },
        {
          y: 20,
          x: 10,
          fragments: [
            {
              kind: 'text',
              content: 'A. Lua chon A',
              x: 10,
              y: 20,
              width: 80,
              height: 10,
              pageNumber: 2,
              order: 1,
            },
          ],
        },
        {
          y: 30,
          x: 10,
          fragments: [
            {
              kind: 'text',
              content: 'H\u00ecnh 1',
              x: 10,
              y: 30,
              width: 40,
              height: 10,
              pageNumber: 2,
              order: 2,
            },
          ],
        },
        {
          y: 40,
          x: 10,
          fragments: [
            {
              kind: 'text',
              content: 'B. Lua chon B',
              x: 10,
              y: 40,
              width: 80,
              height: 10,
              pageNumber: 2,
              order: 3,
            },
          ],
        },
        {
          y: 50,
          x: 10,
          fragments: [
            {
              kind: 'text',
              content: 'Hinh 2.',
              x: 10,
              y: 50,
              width: 40,
              height: 10,
              pageNumber: 2,
              order: 4,
            },
          ],
        },
      ],
    };

    const result = await service.processPageContent(pageContent, null);

    expect(
      result.parserState.currentQuestion?.answerPartsList.map(
        (parts) => parts[0].content,
      ),
    ).toEqual(['Lua chon A', 'Lua chon B']);
  });
});
