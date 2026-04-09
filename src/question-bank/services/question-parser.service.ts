import { Injectable, Logger } from '@nestjs/common';
import { ContentTypes } from 'src/common/enum/content-type.enum';
import { QuestionType } from 'src/question/enum/question-type.enum';
import { PDF_PARSER_CONFIG } from '../constants/pdf-parser.constant';
import {
  AnswerKeyOption,
  PageContent,
  PdfParserState,
  QuestionBlockState,
} from '../types/question-bank-import.types';

@Injectable()
export class QuestionParserService {
  private readonly logger = new Logger(QuestionParserService.name);

  async processPageContent(
    pageContent: PageContent,
    parserState: PdfParserState | null,
  ): Promise<{
    parserState: PdfParserState;
    completedQuestions: QuestionBlockState[];
    totalAnswers: number;
  }> {
    let currentState = this.initializeParserState(parserState);
    let totalAnswers = 0;
    const completedQuestions: QuestionBlockState[] = [];

    for (const line of pageContent.lines) {
      let lineBuffer = '';

      for (const fragment of line.fragments) {
        if (fragment.kind === 'image') {
          if (lineBuffer.trim().length > 0) {
            const processed = this.processTextLine(lineBuffer, currentState);
            currentState = processed.parserState;

            if (processed.completedQuestion) {
              completedQuestions.push(processed.completedQuestion);
            }

            lineBuffer = '';
          }

          currentState = {
            ...currentState,
            currentQuestion: this.appendImageToState(
              currentState.currentQuestion,
              fragment.content,
            ),
          };
          continue;
        }

        lineBuffer = this.mergeLineText(lineBuffer, fragment.content);
      }

      if (lineBuffer.trim().length > 0) {
        const processed = this.processTextLine(lineBuffer, currentState);
        currentState = processed.parserState;

        if (processed.completedQuestion) {
          completedQuestions.push(processed.completedQuestion);
        }
      }
    }

    return { parserState: currentState, completedQuestions, totalAnswers };
  }

  private processTextLine(
    line: string,
    parserState: PdfParserState,
  ): {
    parserState: PdfParserState;
    completedQuestion: QuestionBlockState | null;
    totalAnswers: number;
  } {
    const normalizedLine = line.trim();

    if (!normalizedLine) {
      return {
        parserState,
        completedQuestion: null,
        totalAnswers: 0,
      };
    }

    if (this.isNoiseLine(normalizedLine)) {
      return {
        parserState,
        completedQuestion: null,
        totalAnswers: 0,
      };
    }

    if (this.isAnswerKeyStart(normalizedLine)) {
      const completedQuestion = this.hasImportableContent(
        parserState.currentQuestion,
      )
        ? parserState.currentQuestion
        : null;

      return {
        parserState: {
          ...parserState,
          mode: 'answer_key',
          currentQuestion: null,
        },
        completedQuestion,
        totalAnswers: 0,
      };
    }

    if (parserState.mode === 'answer_key') {
      return {
        parserState: {
          ...parserState,
          answerKey: {
            ...parserState.answerKey,
            ...this.extractAnswerKeyEntries(normalizedLine),
          },
        },
        completedQuestion: null,
        totalAnswers: 0,
      };
    }

    const questionStart = this.extractQuestionStart(normalizedLine);

    if (questionStart) {
      const completedQuestion = this.hasImportableContent(
        parserState.currentQuestion,
      )
        ? parserState.currentQuestion
        : null;

      const currentQuestion: QuestionBlockState = {
        number: questionStart.number,
        questionParts: [],
        answerPartsList: [],
        currentAnswerParts: null,
      };

      this.appendLineToParts(currentQuestion.questionParts, questionStart.content);

      return {
        parserState: {
          ...parserState,
          currentQuestion,
        },
        completedQuestion,
        totalAnswers: 0,
      };
    }

    if (!parserState.currentQuestion) {
      return {
        parserState,
        completedQuestion: null,
        totalAnswers: 0,
      };
    }

    const answerSegments = this.extractAnswerSegments(normalizedLine);

    if (answerSegments.length > 0) {
      for (const answerSegment of answerSegments) {
        const answerParts: Array<{
          content: string;
          contentType: ContentTypes;
        }> = [];

        parserState.currentQuestion.answerPartsList.push(answerParts);
        parserState.currentQuestion.currentAnswerParts = answerParts;
        this.appendLineToParts(answerParts, answerSegment);
      }
    } else if (parserState.currentQuestion.currentAnswerParts) {
      this.appendLineToParts(
        parserState.currentQuestion.currentAnswerParts,
        normalizedLine,
      );
    } else {
      this.appendLineToParts(
        parserState.currentQuestion.questionParts,
        normalizedLine,
      );
    }

    return {
      parserState,
      completedQuestion: null,
      totalAnswers: 0,
    };
  }

  private initializeParserState(
    parserState: PdfParserState | null,
  ): PdfParserState {
    return (
      parserState ?? {
        mode: 'questions',
        currentQuestion: null,
        answerKey: {},
      }
    );
  }

  private isAnswerLine(line: string): boolean {
    return PDF_PARSER_CONFIG.ANSWER_LINE_PATTERN.test(line.trim());
  }

  private isAnswerKeyStart(line: string): boolean {
    return PDF_PARSER_CONFIG.ANSWER_KEY_START_PATTERN.test(line.trim());
  }

  private isNoiseLine(line: string): boolean {
    const compactLine = line.replace(/\s+/g, ' ').trim();
    const normalizedLine = this.normalizeLineForNoiseMatch(line);

    return (
      PDF_PARSER_CONFIG.FIGURE_LABEL_PATTERN.test(compactLine) ||
      PDF_PARSER_CONFIG.FIGURE_LABEL_PATTERN.test(normalizedLine) ||
      PDF_PARSER_CONFIG.NOISE_LINE_PATTERNS.some(
        (pattern) => pattern.test(compactLine) || pattern.test(normalizedLine),
      )
    );
  }

  private extractAnswerSegments(line: string): string[] {
    if (!this.isAnswerLine(line)) {
      return [];
    }

    const normalizedLine = line.trim();
    const matches = [
      ...normalizedLine.matchAll(
        new RegExp(
          PDF_PARSER_CONFIG.ANSWER_SEGMENT_PATTERN.source,
          PDF_PARSER_CONFIG.ANSWER_SEGMENT_PATTERN.flags,
        ),
      ),
    ].filter((match) => typeof match.index === 'number');

    if (matches.length === 0 || matches[0].index !== 0) {
      return [];
    }

    return matches
      .map((match, index) => {
        const startIndex = (match.index ?? 0) + match[0].length;
        const endIndex =
          index + 1 < matches.length
            ? (matches[index + 1].index ?? normalizedLine.length)
            : normalizedLine.length;

        return normalizedLine.slice(startIndex, endIndex).trim();
      })
      .filter((segment) => segment.length > 0);
  }

  private extractAnswerKeyEntries(
    line: string,
  ): Record<number, AnswerKeyOption> {
    const answerKeyEntries: Record<number, AnswerKeyOption> = {};
    const matches = [
      ...line.matchAll(
        new RegExp(
          PDF_PARSER_CONFIG.ANSWER_KEY_ENTRY_PATTERN.source,
          PDF_PARSER_CONFIG.ANSWER_KEY_ENTRY_PATTERN.flags,
        ),
      ),
    ];

    for (const match of matches) {
      const questionNumber = Number.parseInt(match[1], 10);
      const answer = match[2]?.toUpperCase() as AnswerKeyOption | undefined;

      if (
        Number.isNaN(questionNumber) ||
        !answer ||
        !['A', 'B', 'C', 'D'].includes(answer)
      ) {
        continue;
      }

      answerKeyEntries[questionNumber] = answer;
    }

    return answerKeyEntries;
  }

  private extractQuestionStart(
    line: string,
  ): { number: number; content: string } | null {
    const match = line.match(PDF_PARSER_CONFIG.QUESTION_START_PATTERN);

    if (!match) {
      return null;
    }

    const questionNumber = match[1] ?? match[3];
    const questionContent = match[2] ?? match[4] ?? '';
    const parsedNumber = Number.parseInt(questionNumber, 10);

    if (Number.isNaN(parsedNumber)) {
      return null;
    }

    return {
      number: parsedNumber,
      content: questionContent,
    };
  }

  private hasImportableContent(
    currentState: QuestionBlockState | null,
  ): currentState is QuestionBlockState {
    if (!currentState) {
      return false;
    }

    if (currentState.questionParts.length > 0) {
      return true;
    }

    return currentState.answerPartsList.some(
      (answerParts) => answerParts.length > 0,
    );
  }

  private appendLineToParts(
    parts: Array<{ content: string; contentType: ContentTypes }>,
    line: string,
  ): void {
    const normalized = line.trim();

    if (!normalized) {
      return;
    }

    parts.push({
      content: normalized,
      contentType: ContentTypes.TEXT,
    });
  }

  private mergeLineText(currentLine: string, fragment: string): string {
    const normalizedFragment = fragment.trim();

    if (!currentLine) {
      return normalizedFragment;
    }

    if (!normalizedFragment) {
      return currentLine;
    }

    return `${currentLine} ${normalizedFragment}`;
  }

  private normalizeLineForNoiseMatch(line: string): string {
    return line
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[\u0111\u0110]/g, 'd')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  private appendImageToState(
    currentState: QuestionBlockState | null,
    imageContent: string,
  ): QuestionBlockState | null {
    if (!currentState) {
      this.logger.debug('Ignoring image fragment before question start');
      return null;
    }

    const targetParts =
      currentState.currentAnswerParts ?? currentState.questionParts;

    targetParts.push({
      content: imageContent,
      contentType: ContentTypes.IMAGE,
    });

    return currentState;
  }

  getQuestionType(answerCount: number): QuestionType {
    return answerCount > 0
      ? QuestionType.SINGLE_CHOICE
      : QuestionType.TEXT_INPUT;
  }
}
