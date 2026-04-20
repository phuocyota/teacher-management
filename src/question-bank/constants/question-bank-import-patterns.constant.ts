/**
 * Common question and answer patterns seen in imported PDF exam files.
 * Keep this file as the single place to extend parsing heuristics.
 */

export interface QuestionStartPatternDefinition {
  name: string;
  pattern: RegExp;
}

export const QUESTION_START_PATTERNS: QuestionStartPatternDefinition[] = [
  {
    name: 'vn_question_prefix',
    pattern:
      /^(?:(?:Câu|Question)\s*(\d+)\s*[:\.]?\s*(.*)|(\d+)\s*[\.:]+\s*(.*))$/i,
  },
  {
    name: 'vn_question_prefix_with_dash',
    pattern:
      /^(?:(?:Câu|Question)\s*(\d+)\s*[-–—]\s*(.*)|(\d+)\s*[-–—]\s*(.*))$/i,
  },
];

export const ANSWER_LINE_PATTERNS: RegExp[] = [
  /^([A-Da-d])\s*[\.\)\:\-]\s*/,
];

export const ANSWER_SEGMENT_PATTERNS: RegExp[] = [
  /([A-Da-d])\s*[\.\)\:\-]\s*/g,
];

export const ANSWER_KEY_START_PATTERNS: RegExp[] = [
  /^(?:[\*\u2022]\s*)?(?:Đáp\s*án|Answer\s*Key|ĐA)\s*:?\s*$/i,
];

export const ANSWER_KEY_ENTRY_PATTERNS: RegExp[] = [
  /(?:Câu|Question)\s*(\d+)\s*[:.\-]?\s*([A-Da-d])(?:\b|$)/gi,
];

export const NOISE_LINE_PATTERNS: RegExp[] = [
  /^CHƯƠNG\s+TRÌNH\s+GIÁO\s+DỤC\s+KỸ\s+NĂNG\s+SỐNG(?:\s*_?\s*ICHISKILL)?$/iu,
  /^Khối\s+\d+\s*\.\s*Đề kiểm tra học kì\s+[IVX]+\s+\d+$/iu,
  /^chuong trinh giao duc ky nang song(?:\s*_?\s*ichiskill)?$/i,
  /^khoi\s+\d+\s*\.\s*de kiem tra hoc ki\s+[ivx]+\s+\d+$/i,
];

export const FIGURE_LABEL_PATTERNS: RegExp[] = [
  /^(?:Hình|Hinh)\s+\d+[\.:]?$/i,
];

export const QUESTION_GROUP_HINT_PATTERNS: RegExp[] = [
  /\bnối\b/i,
  /\bghép\b/i,
  /\bmatch\b/i,
  /\bđiền\b/i,
  /\bchọn\b/i,
];
