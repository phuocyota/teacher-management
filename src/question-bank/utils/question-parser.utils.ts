import { ContentTypes } from 'src/common/enum/content-type.enum';
import {
  ANSWER_KEY_ENTRY_PATTERNS,
  ANSWER_KEY_START_PATTERNS,
  ANSWER_OPTION_LABELS,
  ANSWER_SEGMENT_PATTERN,
  FIGURE_LABEL_PATTERNS,
  QUESTION_START_PATTERNS,
} from '../constants/question-bank-import-patterns.constant';
import {
  AnswerKeyOption,
  AnswerOptionLabel,
  ImportedContentPart,
} from '../types/question-bank-import.types';
import {
  cloneImportPattern,
  mergeImportText,
  normalizeImportSignature,
  normalizeImportText,
} from './question-import-text.utils';

export interface InlineAnswerKeySplit {
  questionText: string;
  answerText: string;
}

export interface QuestionStartMatch {
  number: number;
  content: string;
}

export interface AnswerSegment {
  label: AnswerOptionLabel;
  content: string;
}

const INLINE_ANSWER_KEY_PATTERN =
  /(?:[\*\u2022]\s*)?(?:\u0110\u00e1p\s*\u00e1n|Dap\s*an|Answer\s*Key|\u0110A|DA)\s*:?\s*/iu;

export function isAnswerKeyStart(line: string): boolean {
  return matchesAnyPattern(line.trim(), ANSWER_KEY_START_PATTERNS);
}

export function extractAnswerKeyEntries(
  line: string,
): Record<number, AnswerKeyOption> {
  const answerKeyEntries: Record<number, AnswerKeyOption> = {};
  const matches = ANSWER_KEY_ENTRY_PATTERNS.flatMap((pattern) => [
    ...line.matchAll(cloneImportPattern(pattern)),
  ]);

  for (const match of matches) {
    const questionNumber = Number.parseInt(match[1], 10);
    const answer = match[2]?.toUpperCase() as AnswerKeyOption | undefined;

    if (
      Number.isNaN(questionNumber) ||
      !answer ||
      !ANSWER_OPTION_LABELS.includes(answer)
    ) {
      continue;
    }

    answerKeyEntries[questionNumber] = answer;
  }

  return answerKeyEntries;
}

export function extractQuestionStart(line: string): QuestionStartMatch | null {
  for (const pattern of QUESTION_START_PATTERNS) {
    const match = line.match(pattern.pattern);

    if (!match) {
      continue;
    }

    const questionNumber = match[1] ?? match[3];
    const content = normalizeQuestionContent(match[2] ?? match[4] ?? '');
    const parsedNumber = Number.parseInt(questionNumber, 10);

    if (Number.isNaN(parsedNumber)) {
      continue;
    }

    return {
      number: parsedNumber,
      content,
    };
  }

  return null;
}

export function sanitizeCommonPdfLine(
  line: string,
  pageNumber: number,
): string | null {
  const compactLine = normalizeImportText(line);

  if (!compactLine) {
    return null;
  }

  if (isStandalonePageNumber(compactLine, pageNumber)) {
    return null;
  }

  if (isFigureLabel(compactLine)) {
    return null;
  }

  const withoutTrailingPageNumber = stripTrailingPageNumber(
    compactLine,
    pageNumber,
  );

  if (!withoutTrailingPageNumber || isFigureLabel(withoutTrailingPageNumber)) {
    return null;
  }

  return withoutTrailingPageNumber;
}

export function splitInlineAnswerKeyLine(
  line: string,
): InlineAnswerKeySplit | null {
  const match = line.match(INLINE_ANSWER_KEY_PATTERN);

  if (!match || typeof match.index !== 'number') {
    return null;
  }

  const questionText = line.slice(0, match.index).trim();
  const answerText = line.slice(match.index + match[0].length).trim();

  if (!answerText) {
    return null;
  }

  if (Object.keys(extractAnswerKeyEntries(answerText)).length === 0) {
    return null;
  }

  return {
    questionText,
    answerText,
  };
}

export function appendLineToParts(
  parts: ImportedContentPart[],
  line: string,
  mergeIntoPreviousTextPart = true,
): void {
  const normalized = line.trim();

  if (!normalized) {
    return;
  }

  const lastPart = parts[parts.length - 1];
  if (
    mergeIntoPreviousTextPart &&
    lastPart &&
    lastPart.contentType === ContentTypes.TEXT
  ) {
    lastPart.content = mergeImportText(lastPart.content, normalized);
    return;
  }

  parts.push({
    content: normalized,
    contentType: ContentTypes.TEXT,
  });
}

export function extractAnswerSegments(
  line: string,
  allowLeadingText = false,
): { leadingText: string; segments: AnswerSegment[] } {
  const normalizedLine = line.trim();

  if (!normalizedLine) {
    return {
      leadingText: '',
      segments: [],
    };
  }

  const matches = [
    ...normalizedLine.matchAll(cloneImportPattern(ANSWER_SEGMENT_PATTERN)),
  ].filter((match) => typeof match.index === 'number');

  if (matches.length === 0) {
    return {
      leadingText: normalizedLine,
      segments: [],
    };
  }

  const firstIndex = matches[0].index ?? 0;
  if (!allowLeadingText && firstIndex !== 0) {
    return {
      leadingText: normalizedLine,
      segments: [],
    };
  }

  const leadingText = normalizedLine.slice(0, firstIndex).trim();
  const segments = matches.map((match, index) => {
    const startIndex = (match.index ?? 0) + match[0].length;
    const endIndex =
      index + 1 < matches.length
        ? (matches[index + 1].index ?? normalizedLine.length)
        : normalizedLine.length;

    return {
      label: match[1].toUpperCase() as AnswerOptionLabel,
      content: normalizedLine.slice(startIndex, endIndex).trim(),
    };
  });

  return {
    leadingText,
    segments,
  };
}

function isStandalonePageNumber(line: string, pageNumber: number): boolean {
  if (!/^\d+$/.test(line)) {
    return false;
  }

  return Number.parseInt(line, 10) === pageNumber;
}

function stripTrailingPageNumber(line: string, pageNumber: number): string {
  if (pageNumber <= 0) {
    return line;
  }

  if (
    extractQuestionStart(line) ||
    isAnswerKeyStart(line) ||
    Object.keys(extractAnswerKeyEntries(line)).length > 0
  ) {
    return line;
  }

  const trailingPageNumberPattern = new RegExp(`^(.*\\S)\\s+${pageNumber}$`, 'u');
  const match = line.match(trailingPageNumberPattern);

  if (!match) {
    return line;
  }

  const candidate = match[1].trim();

  if (candidate.split(/\s+/).length < 4) {
    return line;
  }

  return candidate;
}

function normalizeQuestionContent(content: string): string {
  return content.trim().replace(/^[\s:.\-\u2013\u2014]+/, '').trim();
}

function matchesAnyPattern(line: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => matchesPattern(line, pattern));
}

function matchesPattern(line: string, pattern: RegExp): boolean {
  return new RegExp(pattern.source, pattern.flags.replace('g', '')).test(line);
}

function isFigureLabel(line: string): boolean {
  const compactLine = normalizeImportText(line);
  const normalizedLine = normalizeImportSignature(line);

  return FIGURE_LABEL_PATTERNS.some(
    (pattern) => pattern.test(compactLine) || pattern.test(normalizedLine),
  );
}
