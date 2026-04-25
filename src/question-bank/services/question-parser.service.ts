import { Injectable, Logger } from '@nestjs/common';
import { ContentTypes } from 'src/common/enum/content-type.enum';
import { PdfParsingError } from '../exceptions/pdf-parsing.exception';
import {
  AnswerKeyOption,
  AnswerOptionLabel,
  ImportedContentPart,
  LayoutFragment,
  PageContent,
  ParsedAnswerOption,
  ParsedDocumentResult,
  ParsedQuestionBlock,
} from '../types/question-bank-import.types';
import {
  AnswerSegment,
  appendLineToParts,
  extractAnswerKeyEntries,
  extractAnswerSegments,
  extractQuestionStart,
  isAnswerKeyStart,
  QuestionStartMatch,
  sanitizeCommonPdfLine,
  splitInlineAnswerKeyLine,
} from '../utils/question-parser.utils';
import { joinTextFragments } from '../utils/question-import-text.utils';
import { classifyQuestionType } from '../utils/question-type-classifier.utils';

interface DraftQuestionBlock {
  number: number;
  pageNumber: number;
  stemParts: ImportedContentPart[];
  answers: ParsedAnswerOption[];
  currentAnswer: ParsedAnswerOption | null;
  pendingAnswerAnchors: PendingAnswerAnchor[];
}

interface ParserRuntimeState {
  currentQuestion: DraftQuestionBlock | null;
  parsedQuestions: ParsedQuestionBlock[];
  answerKey: Record<number, AnswerKeyOption>;
}

interface PendingAnswerAnchor {
  label: AnswerOptionLabel;
  x: number;
  y: number;
  answer: ParsedAnswerOption;
}

interface ColumnAnswerTextAnchor {
  label: AnswerOptionLabel;
  x: number;
  text: string;
}

type TextLayoutFragment = LayoutFragment & { kind: 'text' };
type ImageLayoutFragment = LayoutFragment & { kind: 'image' };

type ParseEvent =
  | { kind: 'question_start'; number: number }
  | { kind: 'text'; text: string }
  | { kind: 'answer_start'; label: AnswerOptionLabel; text: string };

interface ProcessLineResult {
  shouldEnterAnswerKey: boolean;
  inlineAnswerKeyText?: string;
}

@Injectable()
export class QuestionParserService {
  private readonly logger = new Logger(QuestionParserService.name);

  async parsePages(pages: PageContent[]): Promise<ParsedDocumentResult> {
    const runtimeState: ParserRuntimeState = {
      currentQuestion: null,
      parsedQuestions: [],
      answerKey: {},
    };
    const flattenedLines = pages.flatMap((page) =>
      page.lines.map((line) => ({
        pageNumber: page.pageNumber,
        line,
      })),
    );

    for (let index = 0; index < flattenedLines.length; index++) {
      const { line, pageNumber } = flattenedLines[index];
      const lineResult = this.processLine(line, runtimeState, pageNumber);

      if (!lineResult.shouldEnterAnswerKey) {
        continue;
      }

      this.finalizeCurrentQuestion(runtimeState);
      const inlineAnswerKeyLines = lineResult.inlineAnswerKeyText
        ? [
            {
              text: lineResult.inlineAnswerKeyText,
              pageNumber,
            },
          ]
        : [];

      runtimeState.answerKey = {
        ...runtimeState.answerKey,
        ...this.parseAnswerKeySection([
          ...inlineAnswerKeyLines,
          ...flattenedLines.slice(index + 1).map((entry) => ({
            pageNumber: entry.pageNumber,
            text: this.composeTextLine(entry.line),
          })),
        ]),
      };
      break;
    }

    this.finalizeCurrentQuestion(runtimeState);

    return {
      questions: runtimeState.parsedQuestions,
      answerKey: runtimeState.answerKey,
    };
  }

  private processLine(
    line: PageContent['lines'][number],
    runtimeState: ParserRuntimeState,
    pageNumber: number,
  ): ProcessLineResult {
    const currentQuestion = runtimeState.currentQuestion;

    if (currentQuestion?.pendingAnswerAnchors.length) {
      const consumedPendingLine = this.tryAppendPendingAnswerLine(
        currentQuestion,
        line,
      );

      if (consumedPendingLine) {
        return { shouldEnterAnswerKey: false };
      }
    }

    if (currentQuestion) {
      const columnAnswerAnchors = this.detectColumnAnswerTextLine(line);

      if (columnAnswerAnchors) {
        this.queuePendingColumnAnswerAnchors(
          currentQuestion,
          columnAnswerAnchors,
          pageNumber,
          line.y,
        );
        return { shouldEnterAnswerKey: false };
      }

      const answerAnchors = this.detectBareAnswerAnchorLine(line);

      if (answerAnchors) {
        this.queuePendingAnswerAnchors(
          currentQuestion,
          answerAnchors,
          pageNumber,
          line.y,
        );
        return { shouldEnterAnswerKey: false };
      }
    }

    let pendingTextFragments: TextLayoutFragment[] = [];

    for (const fragment of line.fragments) {
      if (fragment.kind === 'image') {
        const lineBuffer = joinTextFragments(pendingTextFragments);

        if (lineBuffer.trim()) {
          const lineResult = this.processTextLine(
            lineBuffer,
            runtimeState,
            pageNumber,
          );

          if (lineResult.shouldEnterAnswerKey) {
            return lineResult;
          }
        }

        pendingTextFragments = [];
        this.appendImage(fragment.content, runtimeState, pageNumber);
        continue;
      }

      pendingTextFragments.push(fragment as TextLayoutFragment);
    }

    const lineBuffer = joinTextFragments(pendingTextFragments);

    if (!lineBuffer.trim()) {
      return { shouldEnterAnswerKey: false };
    }

    return this.processTextLine(lineBuffer, runtimeState, pageNumber);
  }

  private processTextLine(
    line: string,
    runtimeState: ParserRuntimeState,
    pageNumber: number,
  ): ProcessLineResult {
    const normalizedLine = sanitizeCommonPdfLine(line, pageNumber);

    if (!normalizedLine) {
      return { shouldEnterAnswerKey: false };
    }

    const inlineAnswerKey = splitInlineAnswerKeyLine(normalizedLine);
    if (inlineAnswerKey) {
      if (inlineAnswerKey.questionText) {
        const prefixResult = this.processTextLine(
          inlineAnswerKey.questionText,
          runtimeState,
          pageNumber,
        );

        if (prefixResult.shouldEnterAnswerKey) {
          return prefixResult;
        }
      }

      return {
        shouldEnterAnswerKey: true,
        inlineAnswerKeyText: inlineAnswerKey.answerText,
      };
    }

    if (isAnswerKeyStart(normalizedLine)) {
      return { shouldEnterAnswerKey: true };
    }

    if (
      runtimeState.currentQuestion &&
      this.shouldAppendLineToStem(runtimeState.currentQuestion, normalizedLine)
    ) {
      this.appendStemText(runtimeState.currentQuestion, normalizedLine);
      return { shouldEnterAnswerKey: false };
    }

    for (const event of this.splitLineIntoEvents(normalizedLine)) {
      this.applyEvent(event, runtimeState, pageNumber);
    }

    return { shouldEnterAnswerKey: false };
  }

  private splitLineIntoEvents(line: string): ParseEvent[] {
    const questionStart = this.detectQuestionStart(line);

    if (questionStart) {
      const answerDetection = this.detectAnswerSegments(
        questionStart.content,
        true,
      );
      const events: ParseEvent[] = [
        {
          kind: 'question_start',
          number: questionStart.number,
        },
      ];

      if (answerDetection.leadingText) {
        events.push({
          kind: 'text',
          text: answerDetection.leadingText,
        });
      }

      events.push(
        ...answerDetection.segments.map((segment) => ({
          kind: 'answer_start' as const,
          label: segment.label,
          text: segment.content,
        })),
      );

      return events;
    }

    const answerDetection = this.detectAnswerSegments(line);
    if (answerDetection.segments.length > 0) {
      return answerDetection.segments.map((segment) => ({
        kind: 'answer_start' as const,
        label: segment.label,
        text: segment.content,
      }));
    }

    return [
      {
        kind: 'text',
        text: line,
      },
    ];
  }

  private detectQuestionStart(line: string): QuestionStartMatch | null {
    return extractQuestionStart(line);
  }

  private detectAnswerSegments(
    line: string,
    allowLeadingText = false,
  ): { leadingText: string; segments: AnswerSegment[] } {
    return extractAnswerSegments(line, allowLeadingText);
  }

  private applyEvent(
    event: ParseEvent,
    runtimeState: ParserRuntimeState,
    pageNumber: number,
  ): void {
    if (event.kind === 'question_start') {
      this.finalizeCurrentQuestion(runtimeState);
      runtimeState.currentQuestion = {
        number: event.number,
        pageNumber,
        stemParts: [],
        answers: [],
        currentAnswer: null,
        pendingAnswerAnchors: [],
      };
      return;
    }

    if (event.kind === 'answer_start') {
      this.startAnswer(runtimeState, pageNumber, event.label, event.text);
      return;
    }

    if (!runtimeState.currentQuestion) {
      return;
    }

    if (runtimeState.currentQuestion.currentAnswer) {
      this.appendAnswerText(
        runtimeState.currentQuestion.currentAnswer,
        event.text,
      );
      return;
    }

    this.appendStemText(runtimeState.currentQuestion, event.text);
  }

  private appendStemText(question: DraftQuestionBlock, text: string): void {
    appendLineToParts(question.stemParts, text);
  }

  private appendStemImage(
    question: DraftQuestionBlock,
    imageContent: string,
  ): void {
    question.stemParts.push({
      content: imageContent,
      contentType: ContentTypes.IMAGE,
    });
  }

  private startAnswer(
    runtimeState: ParserRuntimeState,
    pageNumber: number,
    label: AnswerOptionLabel,
    initialText: string,
  ): void {
    const currentQuestion = runtimeState.currentQuestion;

    if (!currentQuestion) {
      throw new PdfParsingError(
        `Found answer label ${label} before question start`,
        pageNumber,
      );
    }

    const existingAnswer = currentQuestion.answers.find(
      (answer) => answer.label === label,
    );

    if (existingAnswer) {
      const activeAnswer =
        currentQuestion.currentAnswer ??
        currentQuestion.answers[currentQuestion.answers.length - 1] ??
        null;

      if (activeAnswer?.label === label) {
        currentQuestion.currentAnswer = existingAnswer;

        if (initialText) {
          this.appendAnswerText(existingAnswer, initialText);
        }

        return;
      }

      throw new PdfParsingError(
        `Duplicate answer label ${label} detected`,
        pageNumber,
        { questionNumber: currentQuestion.number },
      );
    }

    const answer = this.createAnswerPlaceholder(
      currentQuestion,
      label,
      pageNumber,
    );
    currentQuestion.currentAnswer = answer;

    if (initialText) {
      this.appendAnswerText(answer, initialText);
    }
  }

  private appendAnswerText(answer: ParsedAnswerOption, text: string): void {
    appendLineToParts(answer.parts, text);
  }

  private appendAnswerImage(
    answer: ParsedAnswerOption,
    imageContent: string,
  ): void {
    answer.parts.push({
      content: imageContent,
      contentType: ContentTypes.IMAGE,
    });
  }

  private appendImage(
    imageContent: string,
    runtimeState: ParserRuntimeState,
    pageNumber: number,
  ): void {
    const currentQuestion = runtimeState.currentQuestion;

    if (!currentQuestion) {
      this.logger.debug(
        `Ignoring image fragment before question start on page ${pageNumber}`,
      );
      return;
    }

    if (currentQuestion.currentAnswer) {
      this.appendAnswerImage(currentQuestion.currentAnswer, imageContent);
      return;
    }

    this.appendStemImage(currentQuestion, imageContent);
  }

  private finalizeCurrentQuestion(runtimeState: ParserRuntimeState): void {
    const currentQuestion = runtimeState.currentQuestion;

    if (!currentQuestion) {
      return;
    }

    currentQuestion.answers = this.normalizeQuestionAnswers(
      currentQuestion.answers,
    );

    const classification = classifyQuestionType({
      stemParts: currentQuestion.stemParts,
      answers: currentQuestion.answers,
    });
    const parsedQuestion: ParsedQuestionBlock = {
      number: currentQuestion.number,
      pageNumber: currentQuestion.pageNumber,
      stemParts: currentQuestion.stemParts,
      answers: currentQuestion.answers,
      kind: classification.kind,
      questionType: classification.questionType,
      layoutKey: classification.layoutKey,
    };

    this.validateQuestionBlock(parsedQuestion);
    runtimeState.parsedQuestions.push(parsedQuestion);
    runtimeState.currentQuestion = null;
  }

  private validateQuestionBlock(question: ParsedQuestionBlock): void {
    const hasStemText = question.stemParts.some(
      (part) =>
        part.contentType === ContentTypes.TEXT &&
        part.content.trim().length > 0,
    );

    if (!hasStemText) {
      throw new PdfParsingError(
        'Question stem text is required',
        question.pageNumber,
        {
          questionNumber: question.number,
        },
      );
    }

    if (question.answers.length === 0) {
      return;
    }

    if (question.answers.length < 2 || question.answers.length > 4) {
      throw new PdfParsingError(
        `Question must contain from 2 to 4 answers, received ${question.answers.length}`,
        question.pageNumber,
        { questionNumber: question.number },
      );
    }

    for (const [index, answer] of question.answers.entries()) {
      const expectedLabel = (['A', 'B', 'C', 'D'] as const)[index];

      if (answer.label !== expectedLabel) {
        throw new PdfParsingError(
          `Answer labels must be sequential from A, expected ${expectedLabel} but got ${answer.label}`,
          question.pageNumber,
          { questionNumber: question.number },
        );
      }

      const hasAnswerContent = answer.parts.some(
        (part) =>
          part.contentType === ContentTypes.IMAGE ||
          (part.contentType === ContentTypes.TEXT &&
            part.content.trim().length > 0),
      );

      if (!hasAnswerContent) {
        throw new PdfParsingError(
          `Answer ${answer.label} must contain text or image content`,
          question.pageNumber,
          { questionNumber: question.number },
        );
      }
    }
  }

  private parseAnswerKeySection(
    lines: Array<{ pageNumber: number; text: string }>,
  ): Record<number, AnswerKeyOption> {
    const answerKey: Record<number, AnswerKeyOption> = {};

    for (const line of lines) {
      const normalizedLine = sanitizeCommonPdfLine(line.text, line.pageNumber);

      if (!normalizedLine) {
        continue;
      }

      Object.assign(answerKey, extractAnswerKeyEntries(normalizedLine));
    }

    return answerKey;
  }

  private composeTextLine(line: PageContent['lines'][number]): string {
    return joinTextFragments(line.fragments);
  }

  private shouldAppendLineToStem(
    currentQuestion: DraftQuestionBlock,
    line: string,
  ): boolean {
    if (currentQuestion.answers.length > 0) {
      return false;
    }

    const classification = classifyQuestionType({
      stemParts: currentQuestion.stemParts,
      answers: currentQuestion.answers,
    });

    if (
      classification.kind !== 'matching' &&
      classification.kind !== 'ordering'
    ) {
      return false;
    }

    return /^(\d+|[a-z])\s*[.):-]\s+/i.test(line);
  }

  private detectBareAnswerAnchorLine(
    line: PageContent['lines'][number],
  ): Array<{ label: AnswerOptionLabel; x: number }> | null {
    if (line.fragments.some((fragment) => fragment.kind === 'image')) {
      return null;
    }

    const anchors = line.fragments
      .map((fragment) => {
        if (fragment.kind !== 'text') {
          return null;
        }

        const match = fragment.content.trim().match(/^([A-Da-d])\s*[.)\:\-]?$/);

        if (!match) {
          return null;
        }

        return {
          label: match[1].toUpperCase() as AnswerOptionLabel,
          x: fragment.x,
        };
      })
      .filter(
        (
          anchor,
        ): anchor is {
          label: AnswerOptionLabel;
          x: number;
        } => !!anchor,
      )
      .sort((left, right) => left.x - right.x);

    return anchors.length >= 2 && anchors.length === line.fragments.length
      ? anchors
      : null;
  }

  private detectColumnAnswerTextLine(
    line: PageContent['lines'][number],
  ): ColumnAnswerTextAnchor[] | null {
    if (line.fragments.some((fragment) => fragment.kind === 'image')) {
      return null;
    }

    const anchors: ColumnAnswerTextAnchor[] = [];

    for (const fragment of line.fragments) {
      if (fragment.kind !== 'text') {
        return null;
      }

      const content = fragment.content.trim();
      const match = content.match(/^([A-Da-d])\s*[.)\:\-]\s*(.*)$/);

      if (match) {
        anchors.push({
          label: match[1].toUpperCase() as AnswerOptionLabel,
          x: fragment.x,
          text: match[2]?.trim() ?? '',
        });
        continue;
      }

      if (/^[.,;:!?]+$/.test(content) && anchors.length > 0) {
        anchors[anchors.length - 1].text =
          `${anchors[anchors.length - 1].text}${content}`;
        continue;
      }

      return null;
    }

    return anchors.length >= 2
      ? anchors.sort((left, right) => left.x - right.x)
      : null;
  }

  private queuePendingAnswerAnchors(
    currentQuestion: DraftQuestionBlock,
    anchors: Array<{ label: AnswerOptionLabel; x: number }>,
    pageNumber: number,
    lineY: number,
  ): void {
    if (currentQuestion.pendingAnswerAnchors.length > 0) {
      currentQuestion.pendingAnswerAnchors = [];
    }

    currentQuestion.pendingAnswerAnchors = anchors.map((anchor) => ({
      ...anchor,
      y: lineY,
      answer: this.createAnswerPlaceholder(
        currentQuestion,
        anchor.label,
        pageNumber,
      ),
    }));
    currentQuestion.currentAnswer = null;
  }

  private queuePendingColumnAnswerAnchors(
    currentQuestion: DraftQuestionBlock,
    anchors: ColumnAnswerTextAnchor[],
    pageNumber: number,
    lineY: number,
  ): void {
    if (currentQuestion.pendingAnswerAnchors.length > 0) {
      currentQuestion.pendingAnswerAnchors = [];
    }

    currentQuestion.pendingAnswerAnchors = anchors.map((anchor) => {
      const answer = this.createAnswerPlaceholder(
        currentQuestion,
        anchor.label,
        pageNumber,
      );

      if (anchor.text) {
        this.appendAnswerText(answer, anchor.text);
      }

      return {
        label: anchor.label,
        x: anchor.x,
        y: lineY,
        answer,
      };
    });
    currentQuestion.currentAnswer = null;
  }

  private tryAppendPendingAnswerLine(
    currentQuestion: DraftQuestionBlock,
    line: PageContent['lines'][number],
  ): boolean {
    const anchors = [...currentQuestion.pendingAnswerAnchors].sort(
      (left, right) => left.x - right.x,
    );

    if (anchors.length === 0) {
      return false;
    }

    if (anchors.length > 0) {
      const allAnchorsOutOfRange = anchors.every(
        (anchor) => Math.abs(line.y - anchor.y) > 120,
      );
      if (allAnchorsOutOfRange) {
        currentQuestion.pendingAnswerAnchors = [];
        currentQuestion.currentAnswer = null;
        return false;
      }
    }

    const imageFragments = line.fragments
      .filter(
        (fragment): fragment is ImageLayoutFragment =>
          fragment.kind === 'image',
      )
      .sort((left, right) => left.x - right.x);
    const textFragments = line.fragments
      .filter(
        (fragment): fragment is TextLayoutFragment =>
          fragment.kind === 'text' && fragment.content.trim().length > 0,
      )
      .sort((left, right) => left.x - right.x);

    if (
      textFragments.length > 0 &&
      this.shouldStopPendingAnswerAssignment(anchors, textFragments)
    ) {
      currentQuestion.pendingAnswerAnchors = [];
      currentQuestion.currentAnswer = null;
      return false;
    }

    const assignFragmentsToAnchors = <
      T extends TextLayoutFragment | ImageLayoutFragment,
    >(
      fragments: T[],
      append: (anchor: PendingAnswerAnchor, fragment: T) => void,
    ): void => {
      for (const fragment of fragments) {
        const nearestAnchor = anchors.reduce((closest, candidate) => {
          if (
            Math.abs(candidate.x - fragment.x) <
            Math.abs(closest.x - fragment.x)
          ) {
            return candidate;
          }

          return closest;
        }, anchors[0]);

        append(nearestAnchor, fragment);
      }
    };

    if (imageFragments.length >= anchors.length && textFragments.length === 0) {
      // Track which anchors received fragments
      const anchorsWithContent = new Set<PendingAnswerAnchor>();
      assignFragmentsToAnchors(imageFragments, (anchor, fragment) => {
        this.appendAnswerImage(anchor.answer, fragment.content);
        anchorsWithContent.add(anchor);
      });

      // Remove anchors that received content; keep only those that didn't
      currentQuestion.pendingAnswerAnchors =
        currentQuestion.pendingAnswerAnchors
          .filter((anchor) => !anchorsWithContent.has(anchor))
          .map((anchor) => ({
            ...anchor,
            y: line.y,
          }));
      currentQuestion.currentAnswer = null;
      return true;
    }

    if (imageFragments.length === 1 && textFragments.length === 0) {
      this.appendAnswerImage(anchors[0].answer, imageFragments[0].content);
      currentQuestion.pendingAnswerAnchors = anchors.slice(1).map((anchor) => ({
        ...anchor,
        y: line.y,
      }));
      currentQuestion.currentAnswer = null;
      return true;
    }

    if (textFragments.length >= anchors.length && imageFragments.length === 0) {
      // Track which anchors received fragments
      const anchorsWithContent = new Set<PendingAnswerAnchor>();
      assignFragmentsToAnchors(textFragments, (anchor, fragment) => {
        this.appendAnswerText(anchor.answer, fragment.content);
        anchorsWithContent.add(anchor);
      });

      // Remove anchors that received content; keep only those that didn't
      currentQuestion.pendingAnswerAnchors =
        currentQuestion.pendingAnswerAnchors
          .filter((anchor) => !anchorsWithContent.has(anchor))
          .map((anchor) => ({
            ...anchor,
            y: line.y,
          }));
      currentQuestion.currentAnswer = null;
      return true;
    }

    if (textFragments.length === 1 && imageFragments.length === 0) {
      this.appendAnswerText(anchors[0].answer, textFragments[0].content);
      currentQuestion.pendingAnswerAnchors = anchors.slice(1).map((anchor) => ({
        ...anchor,
        y: line.y,
      }));
      currentQuestion.currentAnswer = null;
      return true;
    }

    if (textFragments.length > 0 && imageFragments.length === 0) {
      // Track which anchors received fragments
      const anchorsWithContent = new Set<PendingAnswerAnchor>();
      assignFragmentsToAnchors(textFragments, (anchor, fragment) => {
        this.appendAnswerText(anchor.answer, fragment.content);
        anchorsWithContent.add(anchor);
      });
      // Remove anchors that received content; keep only those that didn't
      currentQuestion.pendingAnswerAnchors =
        currentQuestion.pendingAnswerAnchors
          .filter((anchor) => !anchorsWithContent.has(anchor))
          .map((anchor) => ({
            ...anchor,
            y: line.y,
          }));
      currentQuestion.currentAnswer = null;
      return true;
    }

    if (imageFragments.length > 0 && textFragments.length === 0) {
      // Track which anchors received fragments
      const anchorsWithContent = new Set<PendingAnswerAnchor>();
      assignFragmentsToAnchors(imageFragments, (anchor, fragment) => {
        this.appendAnswerImage(anchor.answer, fragment.content);
        anchorsWithContent.add(anchor);
      });
      // Remove anchors that received content; keep only those that didn't
      currentQuestion.pendingAnswerAnchors =
        currentQuestion.pendingAnswerAnchors
          .filter((anchor) => !anchorsWithContent.has(anchor))
          .map((anchor) => ({
            ...anchor,
            y: line.y,
          }));
      currentQuestion.currentAnswer = null;
      return true;
    }

    return false;
  }

  private shouldStopPendingAnswerAssignment(
    anchors: PendingAnswerAnchor[],
    textFragments: TextLayoutFragment[],
  ): boolean {
    const textLine = joinTextFragments(textFragments).trim();

    if (!textLine) {
      return false;
    }

    if (this.detectQuestionStart(textLine)) {
      return true;
    }

    const answerDetection = this.detectAnswerSegments(textLine);
    if (answerDetection.segments.length > 0) {
      return true;
    }

    const leftmostAnchorX = Math.min(...anchors.map((anchor) => anchor.x));
    const leftmostTextX = textFragments[0].x;

    return leftmostTextX + 20 < leftmostAnchorX;
  }

  private normalizeQuestionAnswers(
    answers: ParsedAnswerOption[],
  ): ParsedAnswerOption[] {
    const answerOrder: Record<AnswerOptionLabel, number> = {
      A: 0,
      B: 1,
      C: 2,
      D: 3,
    };

    return [...answers].sort(
      (left, right) => answerOrder[left.label] - answerOrder[right.label],
    );
  }

  private createAnswerPlaceholder(
    currentQuestion: DraftQuestionBlock,
    label: AnswerOptionLabel,
    pageNumber: number,
  ): ParsedAnswerOption {
    if (currentQuestion.answers.length >= 4) {
      throw new PdfParsingError(
        `Invalid answer order, expected no more answers but got ${label}`,
        pageNumber,
        { questionNumber: currentQuestion.number },
      );
    }

    if (currentQuestion.answers.some((answer) => answer.label === label)) {
      throw new PdfParsingError(
        `Duplicate answer label ${label} detected`,
        pageNumber,
        { questionNumber: currentQuestion.number },
      );
    }

    const answer: ParsedAnswerOption = {
      label,
      parts: [],
    };

    currentQuestion.answers.push(answer);
    return answer;
  }
}
