/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { ContentTypes } from 'src/common/enum/content-type.enum';
import { PageContent } from '../types/question-bank-import.types';
import { QuestionParserService } from './question-parser.service';
import { StructuredExamParserService } from './structured-exam-parser.service';

describe('StructuredExamParserService', () => {
  const service = new StructuredExamParserService(new QuestionParserService());

  it('parses groups, shared content, audio labels and inline answer keys', async () => {
    const result = await service.parsePages([
      page([
        'PART 1. READING',
        'Choose A, B, C or D.',
        'NHÓM Câu 1-1',
        'DẠNG READING',
        'ĐOẠN VĂN:',
        'Shared passage',
        'CÂU 1: First question',
        'A. One',
        'B. Two',
        'C. Three',
        'D. Four',
        'ĐÁP ÁN: B',
        'PART 2. LISTENING',
        'NHÓM Câu 2-2',
        'DẠNG LISTENING',
        'AUDIO Audio 001',
        'GHI CHÚ: Play twice',
        'CÂU 2: Second question',
        'A. One',
        'B. Two',
        'C. Three',
        'D. Four',
        'ĐÁP ÁN: C',
      ]),
    ]);

    expect(result.document.questions).toHaveLength(2);
    expect(result.document.answerKey).toEqual({ 1: 'B', 2: 'C' });
    expect(
      result.document.questions.map((item) => item.sectionOrderNo),
    ).toEqual([1, 2]);
    expect(result.sections).toEqual([
      expect.objectContaining({
        orderNo: 1,
        instruction: 'Shared passage',
        meta: expect.objectContaining({
          importSource: 'ZIP',
          questionRange: { from: 1, to: 1 },
          questionFormat: 'READING',
        }),
      }),
      expect.objectContaining({
        orderNo: 2,
        instruction: 'Play twice',
        meta: expect.objectContaining({
          questionFormat: 'LISTENING',
          audio: { label: 'Audio 001' },
        }),
      }),
    ]);
  });

  it('rejects a group with a missing question in its declared range', async () => {
    await expect(
      service.parsePages([
        page([
          'PART 1. READING',
          'NHÓM Câu 1-2',
          'DẠNG READING',
          'CÂU 1: First question',
          'A. One',
          'B. Two',
          'C. Three',
          'D. Four',
          'ĐÁP ÁN: B',
        ]),
      ]),
    ).rejects.toThrow('NHÓM Câu 1-2 thiếu câu 2');
  });
});

function page(lines: string[]): PageContent {
  return {
    pageNumber: 1,
    lines: lines.map((content, index) => ({
      x: 10,
      y: index * 10,
      fragments: [
        {
          kind: 'text',
          content,
          contentType: ContentTypes.TEXT,
          x: 10,
          y: index * 10,
          width: 100,
          height: 10,
          pageNumber: 1,
          order: index,
        } as any,
      ],
    })),
  };
}
