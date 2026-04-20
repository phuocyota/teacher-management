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

export interface QuestionBlockState {
  number: number;
  questionParts: ImportedContentPart[];
  answerPartsList: ImportedContentPart[][];
  pendingAnswerMedia: ImportedContentPart[];
  currentAnswerParts: ImportedContentPart[] | null;
}

export interface PdfParserState {
  mode: 'questions' | 'answer_key';
  currentQuestion: QuestionBlockState | null;
  answerKey: Record<number, AnswerKeyOption>;
}
