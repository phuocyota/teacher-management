import { Injectable, Logger } from '@nestjs/common';
import { ContentTypes } from 'src/common/enum/content-type.enum';
import { QuestionType } from 'src/question/enum/question-type.enum';
import { PDF_PARSER_CONFIG } from '../constants/pdf-parser.constant';
import {
  PageContent,
  QuestionBlockState,
} from '../types/question-bank-import.types';

@Injectable()
export class QuestionParserService {
  private readonly logger = new Logger(QuestionParserService.name);

  async processPageContent(
    pageContent: PageContent,
    currentState: QuestionBlockState | null,
  ): Promise<{
    questionState: QuestionBlockState | null;
    completedQuestions: QuestionBlockState[];
    totalAnswers: number;
  }> {
    let totalAnswers = 0;
    const completedQuestions: QuestionBlockState[] = [];

    for (const line of pageContent.lines) {
      let lineBuffer = '';

      for (const fragment of line.fragments) {
        if (fragment.kind === 'image') {
          if (lineBuffer.trim().length > 0) {
            const processed = this.processTextLine(lineBuffer, currentState);

            currentState = processed.questionState;
            if (processed.completedQuestion) {
              completedQuestions.push(processed.completedQuestion);
            }
            lineBuffer = '';
          }

          currentState = this.appendImageToState(
            currentState,
            fragment.content,
          );
          continue;
        }

        lineBuffer = this.mergeLineText(lineBuffer, fragment.content);
      }

      if (lineBuffer.trim().length > 0) {
        const processed = this.processTextLine(lineBuffer, currentState);
        currentState = processed.questionState;
        if (processed.completedQuestion) {
          completedQuestions.push(processed.completedQuestion);
        }
      }
    }

    return { questionState: currentState, completedQuestions, totalAnswers };
  }

  private processTextLine(
    line: string,
    currentState: QuestionBlockState | null,
  ): {
    questionState: QuestionBlockState | null;
    completedQuestion: QuestionBlockState | null;
    totalAnswers: number;
  } {
    const normalizedLine = line.trim();

    if (!normalizedLine) {
      return {
        questionState: currentState,
        completedQuestion: null,
        totalAnswers: 0,
      };
    }

    const questionStart = this.extractQuestionStart(normalizedLine);

    if (questionStart) {
      const completedQuestion = this.hasImportableContent(currentState)
        ? currentState
        : null;

      currentState = {
        number: questionStart.number,
        questionParts: [],
        answerPartsList: [],
        currentAnswerParts: null,
      };

      this.appendLineToParts(currentState.questionParts, questionStart.content);
      return {
        questionState: currentState,
        completedQuestion,
        totalAnswers: 0,
      };
    }

    if (!currentState) {
      return {
        questionState: currentState,
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

        currentState.answerPartsList.push(answerParts);
        currentState.currentAnswerParts = answerParts;
        this.appendLineToParts(answerParts, answerSegment);
      }
    } else if (currentState.currentAnswerParts) {
      this.appendLineToParts(currentState.currentAnswerParts, normalizedLine);
    } else {
      this.appendLineToParts(currentState.questionParts, normalizedLine);
    }

    return {
      questionState: currentState,
      completedQuestion: null,
      totalAnswers: 0,
    };
  }

  private isAnswerLine(line: string): boolean {
    return PDF_PARSER_CONFIG.ANSWER_LINE_PATTERN.test(line.trim());
  }

  private extractAnswerSegments(line: string): string[] {
    if (!this.isAnswerLine(line)) {
      return [];
    }

    const normalizedLine = line.trim();
    const matches = [
      ...normalizedLine.matchAll(/([A-D])[\.\)]\s*/g),
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

    return currentState.answerPartsList.some((answerParts) => answerParts.length > 0);
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

  private appendImageToState(
    currentState: QuestionBlockState | null,
    imageContent: string,
  ): QuestionBlockState | null {
    if (!currentState) {
      this.logger.debug('Ignoring image fragment before question start');
      return null;
    }

    const targetParts =
      currentState?.currentAnswerParts ?? currentState?.questionParts;

    if (targetParts) {
      targetParts.push({
        content: imageContent,
        contentType: ContentTypes.IMAGE,
      });

      return currentState as QuestionBlockState;
    }

    return currentState;
  }

  getQuestionType(answerCount: number): QuestionType {
    return answerCount > 0
      ? QuestionType.SINGLE_CHOICE
      : QuestionType.TEXT_INPUT;
  }
}
