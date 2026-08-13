import { BadRequestException, Injectable } from '@nestjs/common';
import {
  ParsedSection,
  PageContent,
} from '../types/question-bank-import.types';
import { StructuredExamParseResult } from '../types/question-bank-zip-import.types';
import { QuestionParserService } from './question-parser.service';
import {
  extractQuestionStart,
  extractSectionStart,
} from '../utils/question-parser.utils';
import {
  joinTextFragments,
  normalizeImportSignature,
  normalizeImportText,
} from '../utils/question-import-text.utils';

interface PartState {
  orderNo: number;
  title: string;
  instructionLines: string[];
}

interface GroupState {
  section: ParsedSection;
  from: number;
  to: number;
  format?: string;
  audioLabel?: string;
  sharedLines: string[];
  captureSharedContent: boolean;
}

@Injectable()
export class StructuredExamParserService {
  constructor(private readonly questionParser: QuestionParserService) {}

  async parsePages(pages: PageContent[]): Promise<StructuredExamParseResult> {
    const filteredPages: PageContent[] = pages.map((page) => ({
      pageNumber: page.pageNumber,
      lines: [],
    }));
    const sections: ParsedSection[] = [];
    let currentPart: PartState | null = null;
    let currentGroup: GroupState | null = null;
    const inlineAnswerKey: Record<number, 'A' | 'B' | 'C' | 'D'> = {};
    let currentQuestionNumber: number | null = null;

    const finalizeGroup = () => {
      if (!currentGroup) {
        return;
      }

      const partMeta = currentPart
        ? {
            orderNo: currentPart.orderNo,
            title: currentPart.title,
            ...(currentPart.instructionLines.length
              ? { instruction: currentPart.instructionLines.join('\n') }
              : {}),
          }
        : null;
      const instruction = currentGroup.sharedLines.join('\n').trim();

      currentGroup.section.instruction = instruction || undefined;
      currentGroup.section.meta = {
        importSource: 'ZIP',
        part: partMeta,
        questionRange: {
          from: currentGroup.from,
          to: currentGroup.to,
        },
        questionFormat: currentGroup.format ?? null,
        ...(currentGroup.audioLabel
          ? { audio: { label: currentGroup.audioLabel } }
          : {}),
      };
      sections.push(currentGroup.section);
      currentGroup = null;
    };

    for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
      const page = pages[pageIndex];

      for (const line of page.lines) {
        const isTextOnly = line.fragments.every(
          (fragment) => fragment.kind === 'text',
        );
        if (!isTextOnly) {
          filteredPages[pageIndex].lines.push(line);
          continue;
        }

        const text = normalizeImportText(joinTextFragments(line.fragments));
        if (!text) {
          continue;
        }

        const signature = normalizeImportSignature(text);
        if (
          signature.includes('form chuan import api') &&
          signature.includes('giu nguyen cac nhan')
        ) {
          continue;
        }
        const part = extractSectionStart(text);
        if (part) {
          finalizeGroup();
          currentPart = {
            orderNo: part.orderNo,
            title: part.title,
            instructionLines: [],
          };
          continue;
        }

        const groupMatch = signature.match(
          /^nhom\s+cau\s+(\d+)\s*[-\u2013\u2014]\s*(\d+)\s*$/u,
        );
        if (groupMatch) {
          finalizeGroup();
          const from = Number.parseInt(groupMatch[1], 10);
          const to = Number.parseInt(groupMatch[2], 10);
          currentGroup = {
            section: {
              orderNo: sections.length + 1,
              title: text,
            },
            from,
            to,
            sharedLines: [],
            captureSharedContent: false,
          };
          continue;
        }

        const formatMatch = signature.match(/^dang\s*:?\s*(.+)$/u);
        if (formatMatch && currentGroup) {
          currentGroup.format = normalizeImportText(
            formatMatch[1],
          ).toUpperCase();
          continue;
        }

        const audioMatch = text.match(/^A\s*U\s*D\s*I\s*O\s*:?[ ]*(.+)$/iu);
        if (audioMatch && currentGroup) {
          currentGroup.audioLabel = normalizeImportText(audioMatch[1]);
          continue;
        }

        const passageMatch = signature.match(
          /^d\s*o\s*a\s*n\s+v\s*a\s*n\s*:?[ ]*(.*)$/u,
        );
        if (passageMatch && currentGroup) {
          currentGroup.captureSharedContent = true;
          const colonIndex = text.indexOf(':');
          const inlineText =
            colonIndex >= 0 ? text.slice(colonIndex + 1).trim() : '';
          if (inlineText) {
            currentGroup.sharedLines.push(inlineText);
          }
          continue;
        }

        const answerKeyMatch = signature.match(/^dap\s*an\s*:?\s*([a-d])\s*$/u);
        if (answerKeyMatch) {
          if (!currentQuestionNumber) {
            throw new BadRequestException(
              `ĐÁP ÁN xuất hiện trước CÂU ở trang ${page.pageNumber}`,
            );
          }
          inlineAnswerKey[currentQuestionNumber] =
            answerKeyMatch[1].toUpperCase() as 'A' | 'B' | 'C' | 'D';
          continue;
        }

        const noteMatch = signature.match(
          /^g\s*h\s*i\s+c\s*h\s*u\s*:?[ ]*(.*)$/u,
        );
        if (noteMatch && currentGroup) {
          currentGroup.captureSharedContent = true;
          const colonIndex = text.indexOf(':');
          const inlineText =
            colonIndex >= 0 ? text.slice(colonIndex + 1).trim() : '';
          if (inlineText) {
            currentGroup.sharedLines.push(inlineText);
          }
          continue;
        }

        const questionStart = extractQuestionStart(text);
        if (questionStart) {
          if (!currentGroup) {
            throw new BadRequestException(
              `Câu hỏi xuất hiện ngoài NHÓM ở trang ${page.pageNumber}`,
            );
          }
          currentQuestionNumber = questionStart.number;
          currentGroup.captureSharedContent = false;
          filteredPages[pageIndex].lines.push(line);
          continue;
        }

        if (currentGroup?.captureSharedContent) {
          currentGroup.sharedLines.push(text);
          continue;
        }

        if (!currentGroup && currentPart) {
          currentPart.instructionLines.push(text);
          continue;
        }

        filteredPages[pageIndex].lines.push(this.collapseTextLine(line, text));
      }
    }

    finalizeGroup();

    if (sections.length === 0) {
      throw new BadRequestException('PDF không có nhãn NHÓM Câu x-y');
    }

    const document = await this.questionParser.parsePages(filteredPages);
    document.answerKey = { ...document.answerKey, ...inlineAnswerKey };
    const seenQuestionNumbers = new Set<number>();

    for (const question of document.questions) {
      if (seenQuestionNumbers.has(question.number)) {
        throw new BadRequestException(`Trùng số câu ${question.number}`);
      }
      seenQuestionNumbers.add(question.number);

      const section = sections.find((candidate) => {
        const range = candidate.meta?.questionRange as
          | { from?: number; to?: number }
          | undefined;
        return (
          typeof range?.from === 'number' &&
          typeof range.to === 'number' &&
          question.number >= range.from &&
          question.number <= range.to
        );
      });

      if (!section) {
        throw new BadRequestException(
          `Câu ${question.number} không thuộc khoảng của NHÓM nào`,
        );
      }
      question.sectionOrderNo = section.orderNo;
    }

    this.validateSections(
      sections,
      document.questions.map((item) => item.number),
    );
    document.sections = sections;

    return { document, sections };
  }

  private validateSections(
    sections: ParsedSection[],
    questionNumbers: number[],
  ): void {
    const assignedNumbers = new Set<number>();

    for (const section of sections) {
      const range = section.meta?.questionRange as { from: number; to: number };
      if (!range || range.from <= 0 || range.to < range.from) {
        throw new BadRequestException(
          `Khoảng câu không hợp lệ tại ${section.title}`,
        );
      }

      for (let number = range.from; number <= range.to; number++) {
        if (assignedNumbers.has(number)) {
          throw new BadRequestException(
            `Các NHÓM bị chồng lấn tại câu ${number}`,
          );
        }
        assignedNumbers.add(number);
        if (!questionNumbers.includes(number)) {
          throw new BadRequestException(`${section.title} thiếu câu ${number}`);
        }
      }
    }

    if (questionNumbers.some((number) => !assignedNumbers.has(number))) {
      throw new BadRequestException('Có câu hỏi nằm ngoài khoảng NHÓM');
    }
  }

  private collapseTextLine(
    line: PageContent['lines'][number],
    text: string,
  ): PageContent['lines'][number] {
    const first = line.fragments[0];
    return {
      ...line,
      fragments: [
        {
          kind: 'text',
          content: text,
          x: line.x,
          y: line.y,
          width: line.fragments.reduce(
            (total, fragment) => total + Number(fragment.width ?? 0),
            0,
          ),
          height: Math.max(
            ...line.fragments.map((fragment) => Number(fragment.height ?? 0)),
          ),
          pageNumber: first?.pageNumber ?? 0,
          order: first?.order ?? 0,
        },
      ],
    };
  }
}
