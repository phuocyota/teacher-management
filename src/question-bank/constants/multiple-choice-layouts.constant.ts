import { ContentTypes } from 'src/common/enum/content-type.enum';
import {
  ContentLayoutShape,
  ImportedContentPart,
  MultipleChoiceLayoutKey,
  ParsedAnswerOption,
} from '../types/question-bank-import.types';

export interface MultipleChoiceLayoutDefinition {
  key: MultipleChoiceLayoutKey;
  stemShape: ContentLayoutShape;
  answerShape: ContentLayoutShape;
  description: string;
  supportsAnswerCounts: number[];
}

export interface MultipleChoiceLayoutMatch {
  key: MultipleChoiceLayoutKey;
  stemShape: ContentLayoutShape;
  answerShape: ContentLayoutShape;
  answerCount: number;
  definition: MultipleChoiceLayoutDefinition;
}

export const MULTIPLE_CHOICE_LAYOUTS: MultipleChoiceLayoutDefinition[] = [
  {
    key: 'text_only_stem_text_only_answers',
    stemShape: 'text_only',
    answerShape: 'text_only',
    description: 'Stem chi co text, moi dap an chi co text.',
    supportsAnswerCounts: [2, 3, 4],
  },
  {
    key: 'text_only_stem_image_only_answers',
    stemShape: 'text_only',
    answerShape: 'image_only',
    description: 'Stem chi co text, moi dap an chi co hinh.',
    supportsAnswerCounts: [2, 3, 4],
  },
  {
    key: 'text_only_stem_text_with_image_answers',
    stemShape: 'text_only',
    answerShape: 'text_with_image',
    description: 'Stem chi co text, moi dap an gom text va hinh.',
    supportsAnswerCounts: [2, 3, 4],
  },
  {
    key: 'text_only_stem_mixed_answers',
    stemShape: 'text_only',
    answerShape: 'mixed',
    description: 'Stem chi co text, dap an co noi dung hon hop text/hinh.',
    supportsAnswerCounts: [2, 3, 4],
  },
  {
    key: 'image_only_stem_text_only_answers',
    stemShape: 'image_only',
    answerShape: 'text_only',
    description: 'Stem chi co hinh, moi dap an chi co text.',
    supportsAnswerCounts: [2, 3, 4],
  },
  {
    key: 'image_only_stem_image_only_answers',
    stemShape: 'image_only',
    answerShape: 'image_only',
    description: 'Stem chi co hinh, moi dap an chi co hinh.',
    supportsAnswerCounts: [2, 3, 4],
  },
  {
    key: 'image_only_stem_text_with_image_answers',
    stemShape: 'image_only',
    answerShape: 'text_with_image',
    description: 'Stem chi co hinh, moi dap an gom text va hinh.',
    supportsAnswerCounts: [2, 3, 4],
  },
  {
    key: 'image_only_stem_mixed_answers',
    stemShape: 'image_only',
    answerShape: 'mixed',
    description: 'Stem chi co hinh, dap an co noi dung hon hop text/hinh.',
    supportsAnswerCounts: [2, 3, 4],
  },
  {
    key: 'text_with_image_stem_text_only_answers',
    stemShape: 'text_with_image',
    answerShape: 'text_only',
    description: 'Stem gom text va hinh, moi dap an chi co text.',
    supportsAnswerCounts: [2, 3, 4],
  },
  {
    key: 'text_with_image_stem_image_only_answers',
    stemShape: 'text_with_image',
    answerShape: 'image_only',
    description:
      'Stem gom text va hinh, moi dap an chi co hinh. Day la case nhu Cau 8 me cung/robot voi 3 dap an mui ten bang hinh.',
    supportsAnswerCounts: [2, 3, 4],
  },
  {
    key: 'text_with_image_stem_text_with_image_answers',
    stemShape: 'text_with_image',
    answerShape: 'text_with_image',
    description: 'Stem gom text va hinh, moi dap an cung gom text va hinh.',
    supportsAnswerCounts: [2, 3, 4],
  },
  {
    key: 'text_with_image_stem_mixed_answers',
    stemShape: 'text_with_image',
    answerShape: 'mixed',
    description: 'Stem gom text va hinh, dap an co noi dung hon hop text/hinh.',
    supportsAnswerCounts: [2, 3, 4],
  },
  {
    key: 'mixed_stem_mixed_answers',
    stemShape: 'mixed',
    answerShape: 'mixed',
    description: 'Stem va dap an deu la layout hon hop phuc tap.',
    supportsAnswerCounts: [2, 3, 4],
  },
];

export function detectMultipleChoiceLayout(
  stemParts: ImportedContentPart[],
  answers: ParsedAnswerOption[],
): MultipleChoiceLayoutMatch | null {
  if (answers.length === 0) {
    return null;
  }

  const stemShape = detectContentLayoutShape(stemParts);
  const answerShapes = answers.map((answer) =>
    detectContentLayoutShape(answer.parts),
  );
  const firstAnswerShape = answerShapes[0];
  const answerShape = answerShapes.every((shape) => shape === firstAnswerShape)
    ? firstAnswerShape
    : 'mixed';
  const definition =
    MULTIPLE_CHOICE_LAYOUTS.find(
      (layout) =>
        layout.stemShape === stemShape &&
        layout.answerShape === answerShape &&
        layout.supportsAnswerCounts.includes(answers.length),
    ) ??
    MULTIPLE_CHOICE_LAYOUTS.find((layout) => layout.key === 'mixed_stem_mixed_answers');

  if (!definition) {
    return null;
  }

  return {
    key: definition.key,
    stemShape,
    answerShape,
    answerCount: answers.length,
    definition,
  };
}

export function detectContentLayoutShape(
  parts: ImportedContentPart[],
): ContentLayoutShape {
  const hasText = parts.some((part) => part.contentType === ContentTypes.TEXT);
  const hasImage = parts.some(
    (part) => part.contentType === ContentTypes.IMAGE,
  );

  if (hasText && hasImage) {
    return 'text_with_image';
  }

  if (hasText) {
    return 'text_only';
  }

  if (hasImage) {
    return 'image_only';
  }

  return 'mixed';
}
