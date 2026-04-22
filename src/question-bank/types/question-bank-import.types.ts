import { ContentTypes } from 'src/common/enum/content-type.enum';
import { QuestionType } from 'src/question/enum/question-type.enum';

export interface CreatedQuestionSummary {
  id: string;
  content: string;
  type: QuestionType;
  contentType: ContentTypes;
  answerCount: number;
}

export interface ImportedContentPart {
  content: string;
  contentType: ContentTypes;
  meta?: Record<string, unknown> | null;
}

export interface LayoutFragment {
  kind: 'text' | 'image';
  content: string;
  x: number;
  y: number;
  width: number;
  height: number;
  pageNumber: number;
  order: number;
}

export interface LayoutLine {
  y: number;
  x: number;
  fragments: LayoutFragment[];
}

export interface PageContent {
  pageNumber: number;
  lines: LayoutLine[];
}

export type AnswerKeyOption = 'A' | 'B' | 'C' | 'D';
export type AnswerOptionLabel = AnswerKeyOption;

export type ImportedQuestionKind =
  | 'single_choice'
  | 'multiple_choice'
  | 'text_input'
  | 'matching'
  | 'ordering'
  | 'matching_choice'
  | 'unknown';

export type ContentLayoutShape =
  | 'text_only'
  | 'image_only'
  | 'text_with_image'
  | 'mixed';

export type MultipleChoiceLayoutKey =
  | 'text_only_stem_text_only_answers'
  | 'text_only_stem_image_only_answers'
  | 'text_only_stem_mixed_answers'
  | 'image_only_stem_text_only_answers'
  | 'image_only_stem_image_only_answers'
  | 'image_only_stem_mixed_answers'
  | 'text_with_image_stem_text_only_answers'
  | 'text_with_image_stem_image_only_answers'
  | 'text_with_image_stem_mixed_answers'
  | 'mixed_stem_mixed_answers';

export interface ParsedAnswerOption {
  label: AnswerOptionLabel;
  parts: ImportedContentPart[];
}

export interface ParsedQuestionBlock {
  number: number;
  pageNumber: number;
  stemParts: ImportedContentPart[];
  answers: ParsedAnswerOption[];
  kind: ImportedQuestionKind;
  questionType: QuestionType;
  layoutKey?: MultipleChoiceLayoutKey | null;
  answerKey?: AnswerKeyOption;
}

export interface ParsedDocumentResult {
  questions: ParsedQuestionBlock[];
  answerKey: Record<number, AnswerKeyOption>;
}

export interface PdfArtifactRule {
  signature: string;
  zone: 'header' | 'footer';
}
