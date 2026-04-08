import { ContentTypes } from 'src/common/enum/content-type.enum';
import { QuestionParserService } from './question-parser.service';
import { PageContent } from '../types/question-bank-import.types';

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
    expect(result.questionState?.number).toBe(2);
    expect(result.questionState?.questionParts).toEqual([
      { content: 'This is my ___.', contentType: ContentTypes.TEXT },
    ]);
  });

  it('attaches images to the current question state', async () => {
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
    expect(result.questionState?.number).toBe(11);
    expect(result.questionState?.questionParts).toEqual([
      { content: 'base64-image', contentType: ContentTypes.IMAGE },
    ]);
  });
});
