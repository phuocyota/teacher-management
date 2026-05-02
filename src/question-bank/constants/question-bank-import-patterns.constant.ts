import { AnswerOptionLabel } from '../types/question-bank-import.types';

export interface QuestionStartPatternDefinition {
  name: string;
  pattern: RegExp;
}

export const QUESTION_START_PATTERNS: QuestionStartPatternDefinition[] = [
  {
    name: 'vn_or_en_question_prefix',
    pattern:
      /^(?:(?:C(?:\u00e2u|au)|Question)\s*(\d+)\s*[:.]?\s*(.*)|(\d+)\s*[.:]+\s*(.*))$/iu,
  },
  {
    name: 'vn_or_en_question_prefix_with_dash',
    pattern:
      /^(?:(?:C(?:\u00e2u|au)|Question)\s*(\d+)\s*[-\u2013\u2014]\s*(.*)|(\d+)\s*[-\u2013\u2014]\s*(.*))$/iu,
  },
];

export const ANSWER_OPTION_LABELS: AnswerOptionLabel[] = ['A', 'B', 'C', 'D'];

export const ANSWER_SEGMENT_PATTERN =
  /(?:^|\s)([A-Da-d])\s*[\.\)\:\-]\s*/g;

export const ANSWER_KEY_START_PATTERNS: RegExp[] = [
  /^(?:[\*\u2022]\s*)?(?:\u0110\u00e1p\s*\u00e1n|Dap\s*an|Answer\s*Key|\u0110A|DA)\s*:?\s*$/iu,
];

export const ANSWER_KEY_ENTRY_PATTERNS: RegExp[] = [
  /(?:C(?:\u00e2u|au)|Question)\s*(\d+)\s*[:.\-]?\s*([A-Da-d])(?:\b|$)/giu,
  /(?:^|[,\s])(\d+)\s*[\.\)\:\-]\s*([A-Da-d])(?:\b|$)/g,
  /(?:^|[,\s])(\d+)\s*([A-Da-d])(?=[,\s]|$)/g,
];

export const FIGURE_LABEL_PATTERNS: RegExp[] = [
  /^(?:H(?:\u00ecnh|inh))\s+\d+[\.:]?$/iu,
];

export const MATCHING_HINT_PATTERNS: RegExp[] = [
  /\bnoi\s+cot\b/i,
  /\bnoi\s+cau\b/i,
  /\bghep\s+noi\b/i,
  /\bmatch\b/i,
  /\bcot\s*a\b/i,
  /\bcot\s*b\b/i,
];

export const ORDERING_HINT_PATTERNS: RegExp[] = [
  /\bsap\s*xep\b/i,
  /\bthu\s*tu\b/i,
  /\bdung\s*thu\s*tu\b/i,
  /\bdien\s*so\b/i,
  /\bdanh\s*so\b/i,
];

export const MULTIPLE_CHOICE_HINT_PATTERNS: RegExp[] = [
  /\bchon\s*nhieu\b/i,
  /\bnhieu\s*dap\s*an\b/i,
  /\bchon\s*tat\s*ca\b/i,
  /\ball\s*that\s*apply\b/i,
  /\bmultiple\s*answers?\b/i,
];
