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
  AnswerKeyOption,
  CreatedQuestionSummary,
  ImportedContentPart,
  LayoutFragment,
  LayoutLine,
  PageContent,
  ParsedDocumentResult,
  ParsedQuestionBlock,
  PdfArtifactRule,
} from '../types/question-bank-import.types';
import { PdfImageExtractorService } from './pdf-image-extractor.service';
import { QuestionParserService } from './question-parser.service';
import { UploadService } from 'src/upload/upload.service';
import { FileType } from 'src/upload/enum/file-visibility.enum';
import { ANSWER_OPTION_LABELS } from '../constants/question-bank-import-patterns.constant';
import {
  joinTextFragments,
  normalizeImportSignature,
  normalizeImportText,
} from '../utils/question-import-text.utils';
import {
  extractAnswerSegments,
  extractQuestionStart,
} from '../utils/question-parser.utils';

interface ContentChainEntity {
  id: string;
  nextContent?: string;
}

interface PdfImportProcessingResult {
  createdQuestions: CreatedQuestionSummary[];
  totalAnswers: number;
  detectedQuestions: number;
  answerKey: Record<number, AnswerKeyOption>;
}

interface PersistedAnswerResult {
  totalAnswers: number;
  answerCount: number;
}

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
      const pages = await this.readPdfPages(pdfBuffer);
      const filteredPages = this.filterPageArtifacts(pages);
      const parsedDocument =
        await this.parseStrictMultipleChoicePages(filteredPages);
      const importResult = await this.persistParsedQuestions(
        questionBank.id,
        parsedDocument,
      );
      const totalQuestions = await this.questionBankQuestionRepo.count({
        where: { questionBankId: questionBank.id },
      });

      questionBank.totalQuestions = totalQuestions;
      questionBank.totalScore = totalQuestions;
      await this.questionBankRepo.save(questionBank);

      const duration = Date.now() - startTime;
      this.logger.log(
        `PDF import summary for question bank ${questionBankId}: ` +
          `imported ${importResult.createdQuestions.length}/${importResult.detectedQuestions} questions successfully`,
      );
      this.logger.log(
        `PDF import completed in ${duration}ms: ` +
          `${importResult.createdQuestions.length} questions, ${importResult.totalAnswers} answers`,
      );

      return {
        totalQuestions,
        totalAnswers: importResult.totalAnswers,
        questions: importResult.createdQuestions,
        answerKey: this.serializeAnswerKey(importResult.answerKey),
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

      throw error;
    }
  }

  private async readPdfPages(pdfBuffer: Buffer): Promise<PageContent[]> {
    let pdfDocument: any = null;
    let loadingTask: any = null;

    try {
      const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
      loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(pdfBuffer),
        ...PDF_PARSER_CONFIG.PDF_WORKER_OPTIONS,
      });

      pdfDocument = await loadingTask.promise;
      const totalPages = pdfDocument.numPages ?? 0;
      const pages: PageContent[] = [];

      this.logger.debug(`PDF loaded: ${totalPages} pages`);

      for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
        let page: any = null;

        try {
          page = await pdfDocument.getPage(pageNumber);
          pages.push(await this.extractPageContent(page, pageNumber, pdfjsLib));
        } catch (error) {
          throw new PdfParsingError(
            `Failed to read PDF page: ${error}`,
            pageNumber,
          );
        } finally {
          this.cleanupPage(page, pageNumber);
        }
      }

      return pages;
    } catch (error) {
      if (error instanceof PdfParsingError) {
        throw error;
      }

      throw new PdfParsingError(`PDF processing failed: ${error}`);
    } finally {
      await this.cleanupPdfResources(pdfDocument, loadingTask);
    }
  }

  private filterPageArtifacts(pages: PageContent[]): PageContent[] {
    const rules = this.collectHeaderFooterCandidates(pages);

    if (rules.length === 0) {
      return pages;
    }

    return pages.map((page) => this.filterArtifactsFromPage(page, rules));
  }

  private collectHeaderFooterCandidates(
    pages: PageContent[],
  ): PdfArtifactRule[] {
    const counters = new Map<string, Set<number>>();

    for (const page of pages) {
      const headerLines = page.lines.slice(0, 2);
      const footerLines = page.lines.slice(-2);

      for (const line of headerLines) {
        if (!this.isTextOnlyLine(line)) {
          continue;
        }

        const signature = this.buildLineSignature(line, page.pageNumber);

        if (!signature) {
          continue;
        }

        const key = `header:${signature}`;
        const pagesForKey = counters.get(key) ?? new Set<number>();
        pagesForKey.add(page.pageNumber);
        counters.set(key, pagesForKey);
      }

      for (const line of footerLines) {
        if (!this.isTextOnlyLine(line)) {
          continue;
        }

        const signature = this.buildLineSignature(line, page.pageNumber);

        if (!signature) {
          continue;
        }

        const key = `footer:${signature}`;
        const pagesForKey = counters.get(key) ?? new Set<number>();
        pagesForKey.add(page.pageNumber);
        counters.set(key, pagesForKey);
      }
    }

    return [...counters.entries()]
      .filter(([, pageNumbers]) => pageNumbers.size >= 2)
      .map(([key]) => {
        const [zone, ...signatureParts] = key.split(':');

        return {
          zone: zone as PdfArtifactRule['zone'],
          signature: signatureParts.join(':'),
        };
      });
  }

  private buildLineSignature(
    line: LayoutLine,
    pageNumber: number,
  ): string | null {
    const text = this.composeTextLine(line);
    const sanitized = this.sanitizeLineText(text, pageNumber);

    if (!sanitized) {
      return null;
    }

    if (this.isQuestionOrAnswerLine(sanitized)) {
      return null;
    }

    return normalizeImportSignature(sanitized);
  }

  private isQuestionOrAnswerLine(text: string): boolean {
    if (extractQuestionStart(text)) {
      return true;
    }

    if (/^[A-Da-d]\s*[.)\:\-]?\s*$/.test(text.trim())) {
      return true;
    }

    return extractAnswerSegments(text).segments.length > 0;
  }

  private isArtifactLine(
    line: LayoutLine,
    pageNumber: number,
    rules: PdfArtifactRule[],
    zone: PdfArtifactRule['zone'] | null,
  ): boolean {
    if (!zone) {
      return false;
    }

    const signature = this.buildLineSignature(line, pageNumber);

    if (!signature) {
      return false;
    }

    return rules.some(
      (rule) => rule.zone === zone && rule.signature === signature,
    );
  }

  private filterArtifactsFromPage(
    page: PageContent,
    rules: PdfArtifactRule[],
  ): PageContent {
    const headerIndexes = new Set(
      [0, 1].filter((index) => index < page.lines.length),
    );
    const footerIndexes = new Set(
      [page.lines.length - 2, page.lines.length - 1].filter(
        (index) => index >= 0,
      ),
    );

    return {
      ...page,
      lines: page.lines.filter((line, index) => {
        if (!this.isTextOnlyLine(line)) {
          return true;
        }

        const zone: PdfArtifactRule['zone'] | null = headerIndexes.has(index)
          ? 'header'
          : footerIndexes.has(index)
            ? 'footer'
            : null;

        return !this.isArtifactLine(line, page.pageNumber, rules, zone);
      }),
    };
  }

  private sanitizeLineText(
    lineText: string,
    pageNumber: number,
  ): string | null {
    const compactLine = normalizeImportText(lineText);

    if (!compactLine) {
      return null;
    }

    if (
      /^\d+$/.test(compactLine) &&
      Number.parseInt(compactLine, 10) === pageNumber
    ) {
      return null;
    }

    const trailingPageNumberPattern = new RegExp(
      `^(.*\\S)\\s+${pageNumber}$`,
      'u',
    );
    const trailingPageNumberMatch = compactLine.match(
      trailingPageNumberPattern,
    );

    if (!trailingPageNumberMatch) {
      return compactLine;
    }

    const candidate = trailingPageNumberMatch[1].trim();
    return candidate.split(/\s+/).length >= 2 ? candidate : compactLine;
  }

  private async parseStrictMultipleChoicePages(
    pages: PageContent[],
  ): Promise<ParsedDocumentResult> {
    const parsedDocument = await this.questionParser.parsePages(pages);

    for (const question of parsedDocument.questions) {
      this.assertSupportedQuestionBlock(question);
    }

    return parsedDocument;
  }

  private assertSupportedQuestionBlock(question: ParsedQuestionBlock): void {
    if (
      question.kind === 'single_choice' ||
      question.kind === 'multiple_choice' ||
      question.kind === 'text_input'
    ) {
      return;
    }

    throw new PdfParsingError(
      `Question type "${question.kind}" is recognized but not supported by this import flow`,
      question.pageNumber,
      { questionNumber: question.number },
    );
  }

  private async persistParsedQuestions(
    questionBankId: string,
    parsedDocument: ParsedDocumentResult,
  ): Promise<PdfImportProcessingResult> {
    const createdQuestions: CreatedQuestionSummary[] = [];
    let totalAnswers = 0;

    for (const question of parsedDocument.questions) {
      const persistResult = await this.persistQuestionBlock(
        questionBankId,
        question,
        createdQuestions,
        parsedDocument.answerKey,
      );

      totalAnswers += persistResult.totalAnswers;
    }

    return {
      createdQuestions,
      totalAnswers,
      detectedQuestions: parsedDocument.questions.length,
      answerKey: parsedDocument.answerKey,
    };
  }

  private async persistQuestionBlock(
    questionBankId: string,
    question: ParsedQuestionBlock,
    createdQuestions: CreatedQuestionSummary[],
    answerKey: Record<number, AnswerKeyOption>,
  ): Promise<{ totalAnswers: number }> {
    this.logger.debug(
      `Persisting question ${question.number}: ${question.stemParts.length} question parts, ${question.answers.length} answers`,
    );

    const savedQuestions = await this.createContentChain(
      questionBankId,
      question.stemParts,
      { type: question.questionType },
      this.questionService.createBulk.bind(this.questionService),
      this.questionService.updateBulk.bind(this.questionService),
    );
    const rootQuestion = savedQuestions[0];

    // Check which answer is correct based on answerKey
    const correctAnswerLabel = answerKey[question.number];

    const persistedAnswers = await this.persistAnswerBlocks(
      questionBankId,
      question.number,
      rootQuestion,
      question.answers.map((answer) =>
        this.attachAnswerLabelMeta(
          answer.parts,
          answer.label,
          answer.label === correctAnswerLabel,
        ),
      ),
    );

    await this.createQuestionBankQuestionLink(
      questionBankId,
      rootQuestion.id,
      question.number,
    );

    createdQuestions.push(
      this.createQuestionSummary(rootQuestion, persistedAnswers.answerCount),
    );

    return { totalAnswers: persistedAnswers.totalAnswers };
  }

  private attachAnswerLabelMeta(
    answerParts: ImportedContentPart[],
    label: AnswerKeyOption,
    isCorrect?: boolean,
  ): ImportedContentPart[] {
    return answerParts.map((part, index) =>
      index === 0
        ? {
            ...part,
            meta: {
              ...(part.meta ?? {}),
              importOptionLabel: label,
              ...(isCorrect ? { isCorrect: true } : {}),
            },
          }
        : part,
    );
  }

  private async createContentChain<T extends ContentChainEntity>(
    questionBankId: string,
    contentParts: ImportedContentPart[],
    baseEntity: Record<string, unknown>,
    createBulk: (entities: Record<string, unknown>[]) => Promise<T[]>,
    updateBulk: (entities: T[]) => Promise<T[]>,
  ): Promise<T[]> {
    const entities: Record<string, unknown>[] = [];
    const isQuestionEntity = typeof baseEntity.type !== 'undefined';

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

    const textFragments = this.extractTextFragments(
      textContent.items as any[],
      viewport,
      pdfjsLib,
      pageNumber,
    );
    const allFragments = [...textFragments, ...imageFragments].sort(
      (left, right) => this.compareFragments(left, right),
    );

    return {
      pageNumber,
      lines: this.groupFragmentsIntoLines(allFragments),
    };
  }

  private extractTextFragments(
    items: any[],
    viewport: any,
    pdfjsLib: any,
    pageNumber: number,
  ): LayoutFragment[] {
    const textFragments: LayoutFragment[] = [];
    let order = 0;

    for (const item of items) {
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

    return textFragments;
  }

  private compareFragments(
    left: LayoutFragment,
    right: LayoutFragment,
  ): number {
    const verticalDelta = left.y - right.y;

    if (Math.abs(verticalDelta) > PDF_PARSER_CONFIG.LINE_TOLERANCE) {
      return verticalDelta;
    }

    const horizontalDelta = left.x - right.x;

    if (
      Math.abs(horizontalDelta) > PDF_PARSER_CONFIG.HORIZONTAL_DELTA_THRESHOLD
    ) {
      return horizontalDelta;
    }

    return left.order - right.order;
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
      fragments: [...line.fragments].sort((left, right) =>
        this.compareFragments(left, right),
      ),
    }));
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

  private isTextOnlyLine(line: LayoutLine): boolean {
    return line.fragments.every((fragment) => fragment.kind === 'text');
  }

  private composeTextLine(line: LayoutLine): string {
    return joinTextFragments(line.fragments);
  }

  private async persistImagePart(
    questionBankId: string,
    imageObjectOrBase64: any,
    index: number,
  ): Promise<string> {
    let imageBuffer: Buffer;

    // If it's a string (base64), convert to buffer
    if (typeof imageObjectOrBase64 === 'string') {
      imageBuffer = Buffer.from(imageObjectOrBase64, 'base64');
    }
    // If it's an image object with raw data
    else if (imageObjectOrBase64 && imageObjectOrBase64.data) {
      imageBuffer = Buffer.from(imageObjectOrBase64.data);
    }
    // If it's already a buffer
    else if (Buffer.isBuffer(imageObjectOrBase64)) {
      imageBuffer = imageObjectOrBase64;
    }
    // If it's a string representation (JSON), try to parse
    else if (typeof imageObjectOrBase64 === 'object') {
      imageBuffer = Buffer.from(JSON.stringify(imageObjectOrBase64));
    } else {
      this.logger.warn(
        `Cannot convert image to buffer: ${imageObjectOrBase64}`,
      );
      throw new Error('Invalid image format');
    }

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

  private async persistAnswerBlocks(
    questionBankId: string,
    questionNumber: number,
    rootQuestion: ContentChainEntity,
    answerPartsList: ImportedContentPart[][],
  ): Promise<PersistedAnswerResult> {
    let totalAnswers = 0;
    let answerCount = 0;

    for (const answerParts of answerPartsList) {
      this.logger.debug(
        `Persisting answer for question ${questionNumber}: ${answerParts.length} parts`,
      );

      const savedAnswerParts = await this.createContentChain(
        questionBankId,
        answerParts,
        { question: rootQuestion, questionId: rootQuestion.id },
        this.answerService.createBulk.bind(this.answerService),
        this.answerService.updateBulk.bind(this.answerService),
      );

      // Mark first answer part as correct if needed
      const firstAnswerPart = savedAnswerParts[0];
      const isCorrect = answerParts[0]?.meta?.isCorrect;
      if (firstAnswerPart && isCorrect) {
        await this.answerService.updateBulk([
          { ...firstAnswerPart, isCorrect: true },
        ]);
      }

      totalAnswers += savedAnswerParts.length;
      answerCount++;
    }

    return {
      totalAnswers,
      answerCount,
    };
  }

  private createQuestionSummary(
    rootQuestion: ContentChainEntity & {
      content?: unknown;
      type?: unknown;
      contentType?: unknown;
    },
    answerCount: number,
  ): CreatedQuestionSummary {
    return {
      id: rootQuestion.id,
      content: String(rootQuestion.content ?? ''),
      type: rootQuestion.type as QuestionType,
      contentType: rootQuestion.contentType as ContentTypes,
      answerCount,
    };
  }

  private async createQuestionBankQuestionLink(
    questionBankId: string,
    questionId: string,
    orderNo: number,
    points = 1,
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
    answerKey: Record<number, AnswerKeyOption>,
  ): Record<string, AnswerKeyOption> | undefined {
    const entries = Object.entries(answerKey);

    if (entries.length === 0) {
      return undefined;
    }

    return Object.fromEntries(
      entries
        .filter((entry): entry is [string, AnswerKeyOption] =>
          ANSWER_OPTION_LABELS.includes(entry[1] as AnswerKeyOption),
        )
        .map(([key, value]) => [String(key), value]),
    );
  }
}
