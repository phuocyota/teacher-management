import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QuestionBankEntity } from '../question-bank.entity';
import { QuestionBankQuestionEntity } from 'src/question-bank-question/question-bank-question.entity';
import { QuestionService } from 'src/question/question.service';
import { AnswerService } from 'src/answer/answer.service';
import { ContentTypes } from 'src/common/enum/content-type.enum';
import { QuestionType } from 'src/question/enum/question-type.enum';
import { ImportExamResultDto } from '../dto/import-exam.dto';
import {
  ERROR_MESSAGES,
  ENTITY_NAMES,
} from 'src/common/constant/error-messages.constant';
import { PdfParsingError } from '../exceptions/pdf-parsing.exception';
import { PDF_PARSER_CONFIG } from '../constants/pdf-parser.constant';
import {
  CreatedQuestionSummary,
  ImportedContentPart,
  LayoutFragment,
  PageContent,
  PdfParserState,
  QuestionBlockState,
  LayoutLine,
} from '../types/question-bank-import.types';
import { PdfJsLib, PdfPage, PdfViewport } from '../types/pdf-types';
import { PdfImageExtractorService } from './pdf-image-extractor.service';
import { QuestionParserService } from './question-parser.service';
import { UploadService } from 'src/upload/upload.service';
import { FileType } from 'src/upload/enum/file-visibility.enum';

@Injectable()
export class QuestionBankImportService {
  private readonly logger = new Logger(QuestionBankImportService.name);

  constructor(
    @InjectRepository(QuestionBankEntity)
    private readonly questionBankRepo: Repository<QuestionBankEntity>,
    @InjectRepository(QuestionBankQuestionEntity)
    private readonly questionBankQuestionRepo: Repository<QuestionBankQuestionEntity>,
    @Inject(forwardRef(() => QuestionService))
    private readonly questionService: QuestionService,
    @Inject(forwardRef(() => AnswerService))
    private readonly answerService: AnswerService,
    private readonly pdfImageExtractor: PdfImageExtractorService,
    private readonly questionParser: QuestionParserService,
    private readonly uploadService: UploadService,
  ) {}

  private async findQuestionBankById(id: string): Promise<QuestionBankEntity> {
    const record = await this.questionBankRepo.findOne({ where: { id } });

    if (!record) {
      throw new NotFoundException(
        ERROR_MESSAGES.NOT_FOUND_WITH_ID(ENTITY_NAMES.QUESTION_BANK, id),
      );
    }

    return record;
  }

  async importExamFromPdf(
    questionBankId: string,
    pdfBuffer: Buffer,
  ): Promise<ImportExamResultDto> {
    const startTime = Date.now();
    this.logger.debug(
      `Starting PDF import for question bank: ${questionBankId}`,
    );

    const questionBank = await this.findQuestionBankById(questionBankId);

    try {
      const { createdQuestions, totalAnswers, detectedQuestions, answerKey } =
        await this.processPdfOnTheFly(pdfBuffer, questionBank.id);

      const totalQuestions = await this.questionBankQuestionRepo.count({
        where: { questionBankId: questionBank.id },
      });

      questionBank.totalQuestions = totalQuestions;
      await this.questionBankRepo.save(questionBank);

      const duration = Date.now() - startTime;
      this.logger.log(
        `PDF import summary for question bank ${questionBankId}: ` +
          `imported ${createdQuestions.length}/${detectedQuestions} questions successfully`,
      );
      this.logger.log(
        `PDF import completed in ${duration}ms: ` +
          `${createdQuestions.length} questions, ${totalAnswers} answers`,
      );

      return {
        totalQuestions,
        totalAnswers,
        questions: createdQuestions,
        answerKey: this.serializeAnswerKey(answerKey),
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage =
        error instanceof PdfParsingError
          ? error.getDetailedMessage()
          : error instanceof Error
            ? error.message
            : String(error);

      this.logger.error(
        `PDF import failed after ${duration}ms: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );

      if (error instanceof PdfParsingError) {
        throw new BadRequestException(errorMessage);
      }

      throw new BadRequestException(`Lỗi khi parse PDF: ${errorMessage}`);
    }
  }

  private async createContentChain<
    T extends { id: string; nextContent?: string },
  >(
    questionBankId: string,
    contentParts: ImportedContentPart[],
    baseEntity: Record<string, unknown>,
    createBulk: (entities: any[]) => Promise<T[]>,
    updateBulk: (entities: T[]) => Promise<T[]>,
  ): Promise<T[]> {
    const entities: any[] = [];
    const isQuestionEntity = typeof (baseEntity as any)?.type !== 'undefined';

    for (let index = 0; index < contentParts.length; index++) {
      const part = contentParts[index];
      const content =
        part.contentType === ContentTypes.IMAGE
          ? await this.persistImagePart(questionBankId, part.content, index + 1)
          : part.content;

      entities.push({
        ...baseEntity,
        content,
        contentType: part.contentType,
        ...(part.meta ? { meta: part.meta } : {}),
        ...(isQuestionEntity ? { isRoot: index === 0 } : {}),
      });
    }

    const savedEntities = await createBulk(entities);

    if (savedEntities.length > 1) {
      for (let index = 0; index < savedEntities.length - 1; index++) {
        savedEntities[index].nextContent = savedEntities[index + 1].id;
      }

      await updateBulk(savedEntities);
    }

    return savedEntities;
  }

  private resolveStructuredQuestionBlock(
    state: QuestionBlockState,
  ): {
    type: QuestionType;
    questionParts: ImportedContentPart[];
    answerPartsList: ImportedContentPart[][];
  } | null {
    const questionText = this.composePlainText(state.questionParts);
    const matchingBlock = this.parseMatchingBlock(questionText);

    if (matchingBlock) {
      return matchingBlock;
    }

    const orderingBlock = this.parseOrderingBlock(state, questionText);
    if (orderingBlock) {
      return orderingBlock;
    }

    return null;
  }

  private parseMatchingBlock(
    questionText: string,
  ):
    | {
        type: QuestionType.MATCHING;
        questionParts: ImportedContentPart[];
        answerPartsList: ImportedContentPart[][];
      }
    | null {
    const normalized = this.normalizeText(questionText);

    if (
      !/(\bnối\b|\bghép\b|\bmatch\b)/i.test(normalized) ||
      !/\bcột\s*a\b/i.test(normalized) ||
      !/\bcột\s*b\b/i.test(normalized)
    ) {
      return null;
    }

    const leftStart = normalized.search(/\b1\.\s+/);
    const rightStart = normalized.search(/\ba\.\s+/i);

    if (leftStart < 0 || rightStart < 0 || rightStart <= leftStart) {
      return null;
    }

    const prompt = this.normalizeText(normalized.slice(0, leftStart));
    const leftSection = normalized.slice(leftStart, rightStart);
    const rightSection = normalized.slice(rightStart);

    const leftItems = [...leftSection.matchAll(/(\d+)\.\s*([\s\S]*?)(?=(?:\s+\d+\.\s)|$)/gi)]
      .map((match) => ({
        key: match[1],
        text: this.normalizeText(match[2] ?? ''),
      }))
      .filter((item) => item.text.length > 0);

    const rightItems = [...rightSection.matchAll(/([a-z])\.\s*([\s\S]*?)(?=(?:\s+[a-z]\.\s)|$)/gi)]
      .map((match) => ({
        key: match[1].toLowerCase(),
        text: this.normalizeText(match[2] ?? ''),
      }))
      .filter((item) => item.text.length > 0);

    if (leftItems.length === 0 || rightItems.length === 0) {
      return null;
    }

    const pairCount = Math.min(leftItems.length, rightItems.length);
    const answerPartsList = Array.from({ length: pairCount }, (_, index) => [
      {
        content: leftItems[index].text,
        contentType: ContentTypes.TEXT,
        meta: {
          kind: 'matching',
          leftKey: leftItems[index].key,
          leftText: leftItems[index].text,
          rightKey: rightItems[index].key,
          rightText: rightItems[index].text,
        },
      },
    ]);

    return {
      type: QuestionType.MATCHING,
      questionParts: prompt
        ? [
            {
              content: prompt,
              contentType: ContentTypes.TEXT,
            },
          ]
        : [],
      answerPartsList,
    };
  }

  private parseOrderingBlock(
    state: QuestionBlockState,
    questionText: string,
  ):
    | {
        type: QuestionType.ORDERING;
        questionParts: ImportedContentPart[];
        answerPartsList: ImportedContentPart[][];
      }
    | null {
    const normalized = this.normalizeText(questionText);

    if (
      !/(\bsắp\s*xếp\b|\bthứ\s*tự\b|\bđúng\s*thứ\s*tự\b|\bđiền\s*số\b|\bđánh\s*số\b)/i.test(
        normalized,
      )
    ) {
      return null;
    }

    const itemMatches = [
      ...normalized.matchAll(/Hình\s*số\.?\s*(?:☐|□)?\s*([\s\S]*?)(?=(?:Hình\s*số\.?|\s*$))/gi),
    ];

    const orderingItems = itemMatches
      .map((match) => this.normalizeText(match[1] ?? ''))
      .filter((item) => item.length > 0);

    if (orderingItems.length === 0) {
      return null;
    }

    const promptCutoff = normalized.search(/Hình\s*số\.?/i);
    const prompt = promptCutoff > 0 ? this.normalizeText(normalized.slice(0, promptCutoff)) : normalized;
    const mediaParts = state.pendingAnswerMedia.filter(
      (part) => part.contentType === ContentTypes.IMAGE,
    );

    const answerPartsList = orderingItems.map((item, index) => {
      const media = mediaParts[index];
      const content = media ? media.content : item;
      return [
        {
          content,
          contentType: media ? media.contentType : ContentTypes.TEXT,
          meta: {
            kind: 'ordering',
            position: index + 1,
            label: item,
          },
        },
      ];
    });

    return {
      type: QuestionType.ORDERING,
      questionParts: prompt
        ? [
            {
              content: prompt,
              contentType: ContentTypes.TEXT,
            },
          ]
        : [],
      answerPartsList,
    };
  }

  private composePlainText(parts: ImportedContentPart[]): string {
    return parts
      .filter((part) => part.contentType === ContentTypes.TEXT)
      .map((part) => part.content)
      .join(' ');
  }

  private normalizeText(value: string): string {
    return value.replace(/\s+/g, ' ').replace(/\u00a0/g, ' ').trim();
  }

  private async persistImagePart(
    questionBankId: string,
    base64Content: string,
    index: number,
  ): Promise<string> {
    const imageBuffer = Buffer.from(base64Content, 'base64');
    const uploaded = await this.uploadService.saveBufferAsFile(imageBuffer, {
      originalName: `pdf-image-${Date.now()}-${index}.png`,
      mimetype: 'image/png',
      uploadedBy: 'pdf-import',
      fileType: FileType.NORMAL,
      description: 'Generated from PDF import',
      folderPath: `question-banks/${questionBankId}`,
      storedPathPrefix: '/uploads',
    });

    return uploaded.path;
  }

  private async processPdfOnTheFly(
    pdfBuffer: Buffer,
    questionBankId: string,
  ): Promise<{
    createdQuestions: CreatedQuestionSummary[];
    totalAnswers: number;
    detectedQuestions: number;
    answerKey: Record<number, 'A' | 'B' | 'C' | 'D'>;
  }> {
    let pdfDocument: any = null;
    let loadingTask: any = null;

    try {
      const pdfjsLib: any = await import('pdfjs-dist/legacy/build/pdf.mjs');
      loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(pdfBuffer),
        ...PDF_PARSER_CONFIG.PDF_WORKER_OPTIONS,
      });

      pdfDocument = await loadingTask.promise;
      const totalPages = pdfDocument.numPages ?? 0;

      this.logger.debug(`PDF loaded: ${totalPages} pages`);

      const createdQuestions: CreatedQuestionSummary[] = [];
      let totalAnswers = 0;
      let detectedQuestions = 0;
      let parserState: PdfParserState | null = null;

      for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
        let page: any = null;

        try {
          page = await pdfDocument.getPage(pageNumber);
          const pageContent = await this.extractPageContent(
            page,
            pageNumber,
            pdfjsLib,
          );

          const result = await this.questionParser.processPageContent(
            pageContent,
            parserState,
          );

          detectedQuestions += result.completedQuestions.length;

          for (const completedQuestion of result.completedQuestions) {
            this.logger.debug(
              `Flushing parsed question ${completedQuestion.number} from page ${pageNumber}`,
            );
            const flushResult = await this.flushQuestionBlock(
              completedQuestion,
              questionBankId,
              createdQuestions,
            );
            totalAnswers += flushResult.totalAnswers;
            this.logger.debug(
              `Question ${completedQuestion.number} flushed successfully`,
            );
          }

          parserState = result.parserState;
          totalAnswers += result.totalAnswers;

          this.logger.debug(`Page ${pageNumber} processed`);
        } catch (error) {
          throw new PdfParsingError(
            `Failed to process page: ${error}`,
            pageNumber,
          );
        } finally {
          this.cleanupPage(page, pageNumber);
        }
      }

      // Flush remaining question
      if (parserState?.currentQuestion) {
        detectedQuestions++;
        this.logger.debug(
          `Flushing final question ${parserState.currentQuestion.number} after page loop`,
        );
        const result = await this.flushQuestionBlock(
          parserState.currentQuestion,
          questionBankId,
          createdQuestions,
        );
        totalAnswers += result.totalAnswers;
        this.logger.debug(
          `Final question ${parserState.currentQuestion.number} flushed successfully`,
        );
      }

      return {
        createdQuestions,
        totalAnswers,
        detectedQuestions,
        answerKey: parserState?.answerKey ?? {},
      };
    } catch (error) {
      if (error instanceof PdfParsingError) {
        throw error;
      }
      throw new PdfParsingError(`PDF processing failed: ${error}`);
    } finally {
      await this.cleanupPdfResources(pdfDocument, loadingTask);
    }
  }

  private cleanupPage(page: any, pageNumber: number): void {
    if (!page || typeof page.cleanup !== 'function') {
      return;
    }

    try {
      page.cleanup();
    } catch (error) {
      this.logger.warn(`Failed to cleanup page ${pageNumber}: ${error}`);
    }
  }

  private async cleanupPdfResources(
    pdfDocument: any,
    loadingTask: any,
  ): Promise<void> {
    if (pdfDocument && typeof pdfDocument.destroy === 'function') {
      try {
        this.logger.debug('Destroying PDF document');
        const didDestroy = await Promise.race<boolean>([
          Promise.resolve(pdfDocument.destroy()).then(() => true),
          new Promise<boolean>((resolve) =>
            setTimeout(
              () => resolve(false),
              PDF_PARSER_CONFIG.PDF_DOCUMENT_DESTROY_TIMEOUT_MS,
            ),
          ),
        ]);

        if (!didDestroy) {
          this.logger.warn(
            `Timed out destroying PDF document after ${PDF_PARSER_CONFIG.PDF_DOCUMENT_DESTROY_TIMEOUT_MS}ms`,
          );
        } else {
          this.logger.debug('PDF document destroyed');
        }
      } catch (error) {
        this.logger.warn(`Failed to destroy PDF document: ${error}`);
      }
    }

    if (loadingTask && typeof loadingTask.destroy === 'function') {
      try {
        loadingTask.destroy();
      } catch (error) {
        this.logger.warn(`Failed to destroy PDF loading task: ${error}`);
      }
    }
  }

  private async extractPageContent(
    page: any,
    pageNumber: number,
    pdfjsLib: any,
  ): Promise<PageContent> {
    const viewport = page.getViewport({ scale: 1 });
    const [textContent, imageFragments] = await Promise.all([
      page.getTextContent({
        normalizeWhitespace: true,
        disableCombineTextItems: false,
      }),
      this.pdfImageExtractor.extractPageImages(
        page,
        pageNumber,
        pdfjsLib,
        viewport,
      ),
    ]);

    const textFragments: LayoutFragment[] = [];
    let order = 0;

    for (const item of textContent.items as any[]) {
      const content = typeof item.str === 'string' ? item.str.trim() : '';

      if (!content) {
        continue;
      }

      const transform = pdfjsLib.Util.transform(
        viewport.transform,
        item.transform,
      );
      textFragments.push({
        kind: 'text',
        content,
        x: transform[4],
        y: transform[5],
        width: item.width ?? 0,
        height: item.height ?? 0,
        pageNumber,
        order: order++,
      });
    }

    const allFragments = [...textFragments, ...imageFragments].sort(
      (left, right) => {
        const verticalDelta = left.y - right.y;

        if (Math.abs(verticalDelta) > PDF_PARSER_CONFIG.LINE_TOLERANCE) {
          return verticalDelta;
        }

        const horizontalDelta = left.x - right.x;

        if (
          Math.abs(horizontalDelta) >
          PDF_PARSER_CONFIG.HORIZONTAL_DELTA_THRESHOLD
        ) {
          return horizontalDelta;
        }

        return left.order - right.order;
      },
    );

    return {
      pageNumber,
      lines: this.groupFragmentsIntoLines(allFragments),
    };
  }

  private groupFragmentsIntoLines(fragments: LayoutFragment[]): LayoutLine[] {
    const lines: LayoutLine[] = [];

    for (const fragment of fragments) {
      const currentLine = lines[lines.length - 1];

      if (
        !currentLine ||
        Math.abs(currentLine.y - fragment.y) > PDF_PARSER_CONFIG.LINE_TOLERANCE
      ) {
        lines.push({
          y: fragment.y,
          x: fragment.x,
          fragments: [fragment],
        });
        continue;
      }

      currentLine.fragments.push(fragment);
      currentLine.x = Math.min(currentLine.x, fragment.x);
    }

    return lines.map((line) => ({
      ...line,
      fragments: [...line.fragments].sort((left, right) => {
        const horizontalDelta = left.x - right.x;

        if (
          Math.abs(horizontalDelta) >
          PDF_PARSER_CONFIG.HORIZONTAL_DELTA_THRESHOLD
        ) {
          return horizontalDelta;
        }

        return left.order - right.order;
      }),
    }));
  }

  private async flushQuestionBlock(
    state: QuestionBlockState,
    questionBankId: string,
    createdQuestions: CreatedQuestionSummary[],
  ): Promise<{ totalAnswers: number }> {
    const structuredBlock = this.resolveStructuredQuestionBlock(state);
    const answerPartsList =
      structuredBlock?.answerPartsList ?? state.answerPartsList;
    const questionParts =
      structuredBlock?.questionParts ??
      (answerPartsList.length > 0
        ? state.questionParts.length > 0
          ? state.questionParts
          : [
              {
                content: '',
                contentType: ContentTypes.TEXT,
              },
            ]
        : [...state.questionParts, ...state.pendingAnswerMedia]);

    if (questionParts.length === 0) {
      return { totalAnswers: 0 };
    }

    const resolvedQuestionType =
      structuredBlock?.type ??
      this.questionParser.getQuestionType(answerPartsList.length);

    this.logger.debug(
      `Persisting question ${state.number}: ${questionParts.length} question parts, ${answerPartsList.length} answers`,
    );

    const savedParts = await this.createContentChain(
      questionBankId,
      questionParts,
      { type: resolvedQuestionType },
      this.questionService.createBulk.bind(this.questionService),
      this.questionService.updateBulk.bind(this.questionService),
    );

    const rootQuestion = savedParts[0];

    let totalAnswers = 0;
    let answerCount = 0;

    for (const answerParts of answerPartsList) {
      this.logger.debug(
        `Persisting answer for question ${state.number}: ${answerParts.length} parts`,
      );
      const savedAnswerParts = await this.createContentChain(
        questionBankId,
        answerParts,
        { question: rootQuestion, questionId: rootQuestion.id },
        this.answerService.createBulk.bind(this.answerService),
        this.answerService.updateBulk.bind(this.answerService),
      );

      totalAnswers += savedAnswerParts.length;
      answerCount++;
    }

    await this.createQuestionBankQuestionLink(
      questionBankId,
      rootQuestion.id,
      state.number,
    );

    this.logger.debug(
      `Linked question ${state.number} to question bank ${questionBankId}`,
    );

    createdQuestions.push({
      id: rootQuestion.id,
      content: (rootQuestion as any).content,
      type: (rootQuestion as any).type,
      contentType: (rootQuestion as any).contentType,
      answerCount,
    });

    return { totalAnswers };
  }

  private async createQuestionBankQuestionLink(
    questionBankId: string,
    questionId: string,
    orderNo: number,
    points = 0,
  ): Promise<void> {
    const link = this.questionBankQuestionRepo.create({
      questionBankId,
      questionId,
      orderNo,
      points,
    });

    await this.questionBankQuestionRepo.save(link);
  }

  private serializeAnswerKey(
    answerKey: Record<number, 'A' | 'B' | 'C' | 'D'>,
  ): Record<string, 'A' | 'B' | 'C' | 'D'> | undefined {
    const entries = Object.entries(answerKey);

    if (entries.length === 0) {
      return undefined;
    }

    return Object.fromEntries(entries.map(([key, value]) => [String(key), value]));
  }
}
