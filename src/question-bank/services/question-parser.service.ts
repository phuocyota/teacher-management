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
    totalAnswers: number;
  }> {
    let totalAnswers = 0;

    for (const line of pageContent.lines) {
      let lineBuffer = '';

      for (const fragment of line.fragments) {
        if (fragment.kind === 'image') {
          if (lineBuffer.trim().length > 0) {
            const processed = this.processTextLine(lineBuffer, currentState);

            currentState = processed.questionState;
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
      }
    }

    return { questionState: currentState, totalAnswers };
  }

  private processTextLine(
    line: string,
    currentState: QuestionBlockState | null,
  ): {
    questionState: QuestionBlockState | null;
    totalAnswers: number;
  } {
    const normalizedLine = line.trim();

    if (!normalizedLine) {
      return { questionState: currentState, totalAnswers: 0 };
    }

    const startMatch = normalizedLine.match(
      PDF_PARSER_CONFIG.QUESTION_START_PATTERN,
    );

    if (startMatch) {
      currentState = {
        number: Number.parseInt(startMatch[1], 10) || 1,
        questionParts: [],
        answerPartsList: [],
        currentAnswerParts: null,
      };

      this.appendLineToParts(currentState.questionParts, startMatch[2] ?? '');
      return { questionState: currentState, totalAnswers: 0 };
    }

    if (!currentState) {
      return { questionState: currentState, totalAnswers: 0 };
    }

    if (this.isAnswerLine(normalizedLine)) {
      const answerParts: Array<{
        content: string;
        contentType: ContentTypes;
      }> = [];

      currentState.answerPartsList.push(answerParts);
      currentState.currentAnswerParts = answerParts;

      const answerContent = normalizedLine.replace(
        PDF_PARSER_CONFIG.ANSWER_LINE_PATTERN,
        '',
      );
      this.appendLineToParts(answerParts, answerContent);
    } else if (currentState.currentAnswerParts) {
      this.appendLineToParts(currentState.currentAnswerParts, normalizedLine);
    } else {
      this.appendLineToParts(currentState.questionParts, normalizedLine);
    }

    return { questionState: currentState, totalAnswers: 0 };
  }

  private isAnswerLine(line: string): boolean {
    return PDF_PARSER_CONFIG.ANSWER_LINE_PATTERN.test(line.trim());
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
  ): QuestionBlockState {
    const targetParts =
      currentState?.currentAnswerParts ?? currentState?.questionParts;

    if (targetParts) {
      targetParts.push({
        content: imageContent,
        contentType: ContentTypes.IMAGE,
      });

      return currentState as QuestionBlockState;
    }

    // No state, create new one with image
    return {
      number: 1,
      questionParts: [
        {
          content: imageContent,
          contentType: ContentTypes.IMAGE,
        },
      ],
      answerPartsList: [],
      currentAnswerParts: null,
    };
  }

  getQuestionType(answerCount: number): QuestionType {
    return answerCount > 0
      ? QuestionType.SINGLE_CHOICE
      : QuestionType.TEXT_INPUT;
  }
}
