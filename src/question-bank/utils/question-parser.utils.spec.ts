import { extractSectionStart } from './question-parser.utils';

describe('extractSectionStart', () => {
  it.each([
    'phân loại rác thải đúng nơi quy định.',
    'phân chia công việc.',
    'phân công nhiệm vụ.',
    'phần việc của mình.',
    'PART IIIustration',
    'PHẦN 12abc',
    'PHÂN I: phân loại rác',
    'phân 1: công việc',
    'PHẦN CIVIL: nội dung thông thường',
    'PHẦN IIII: không phải số La Mã hợp lệ',
    'PART IC: invalid numeral',
    'PHẦN 0: không hợp lệ',
    'PART 999999999999999999999: unsafe number',
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
    ['Phần IX: Vận dụng', 9],
    ['phần ii: đọc hiểu', 2],
  ])('recognizes a complete section number: %s', (text, orderNo) => {
    expect(extractSectionStart(text)).toEqual({ orderNo, title: text });
  });

  it('recognizes Vietnamese headings with decomposed PDF accents', () => {
    const title = 'PHẦN I: Trắc nghiệm';
    expect(extractSectionStart(title.normalize('NFD'))).toEqual({
      orderNo: 1,
      title,
    });
  });
});
