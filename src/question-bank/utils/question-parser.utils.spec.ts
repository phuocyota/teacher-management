import { extractSectionStart } from './question-parser.utils';

describe('extractSectionStart', () => {
  it.each([
    'phân loại rác thải đúng nơi quy định.',
    'phân chia công việc.',
    'phân công nhiệm vụ.',
    'phần việc của mình.',
    'PART IIIustration',
    'PHẦN 12abc',
  ])('keeps ordinary text as content: %s', (text) => {
    expect(extractSectionStart(text)).toBeNull();
  });

  it.each([
    ['PART I: VOCABULARY', 1],
    ['PART II. GRAMMAR', 2],
    ['PHẦN 1: Trắc nghiệm', 1],
    ['Phần IV – Đọc hiểu', 4],
    ['PHẦN 2', 2],
    ['PART III-READING', 3],
    ['PART 4 Reading', 4],
  ])('recognizes a complete section number: %s', (text, orderNo) => {
    expect(extractSectionStart(text)).toEqual({ orderNo, title: text });
  });
});
