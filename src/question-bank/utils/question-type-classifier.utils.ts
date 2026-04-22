import { ContentTypes } from 'src/common/enum/content-type.enum';
import { QuestionType } from 'src/question/enum/question-type.enum';
import { detectMultipleChoiceLayout } from '../constants/multiple-choice-layouts.constant';
import {
  MATCHING_HINT_PATTERNS,
  MULTIPLE_CHOICE_HINT_PATTERNS,
  ORDERING_HINT_PATTERNS,
} from '../constants/question-bank-import-patterns.constant';
import {
  ImportedContentPart,
  ImportedQuestionKind,
  MultipleChoiceLayoutKey,
  ParsedAnswerOption,
} from '../types/question-bank-import.types';
import { normalizeImportSignature } from './question-import-text.utils';

export interface QuestionTypeClassifierInput {
  stemParts: ImportedContentPart[];
  answers: ParsedAnswerOption[];
}

export interface QuestionTypeClassifierResult {
  kind: ImportedQuestionKind;
  questionType: QuestionType;
  layoutKey: MultipleChoiceLayoutKey | null;
}

export function classifyQuestionType(
  input: QuestionTypeClassifierInput,
): QuestionTypeClassifierResult {
  const stemSignature = normalizeImportSignature(
    input.stemParts
      .filter((part) => part.contentType === ContentTypes.TEXT)
      .map((part) => part.content)
      .join(' '),
  );
  const hasAnswers = input.answers.length > 0;
  const hasMatchingHints = MATCHING_HINT_PATTERNS.some((pattern) =>
    pattern.test(stemSignature),
  );
  const hasOrderingHints = ORDERING_HINT_PATTERNS.some((pattern) =>
    pattern.test(stemSignature),
  );
  const hasMultipleChoiceHints = MULTIPLE_CHOICE_HINT_PATTERNS.some((pattern) =>
    pattern.test(stemSignature),
  );

  if (hasMatchingHints && hasAnswers) {
    return {
      kind: 'matching_choice',
      questionType: QuestionType.SINGLE_CHOICE,
      layoutKey: detectMultipleChoiceLayout(input.stemParts, input.answers)?.key ?? null,
    };
  }

  if (hasOrderingHints && !hasAnswers) {
    return {
      kind: 'ordering',
      questionType: QuestionType.ORDERING,
      layoutKey: null,
    };
  }

  if (hasMatchingHints && !hasAnswers) {
    return {
      kind: 'matching',
      questionType: QuestionType.MATCHING,
      layoutKey: null,
    };
  }

  if (hasAnswers && hasMultipleChoiceHints) {
    return {
      kind: 'multiple_choice',
      questionType: QuestionType.MULTIPLE_CHOICE,
      layoutKey: detectMultipleChoiceLayout(input.stemParts, input.answers)?.key ?? null,
    };
  }

  if (hasAnswers) {
    return {
      kind: 'single_choice',
      questionType: QuestionType.SINGLE_CHOICE,
      layoutKey: detectMultipleChoiceLayout(input.stemParts, input.answers)?.key ?? null,
    };
  }

  return {
    kind: 'text_input',
    questionType: QuestionType.TEXT_INPUT,
    layoutKey: null,
  };
}
