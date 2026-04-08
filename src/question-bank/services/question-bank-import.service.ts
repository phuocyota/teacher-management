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
  LayoutFragment,
  PageContent,
  QuestionBlockState,
  LayoutLine,
} from '../types/question-bank-import.types';
import { PdfJsLib, PdfPage, PdfViewport } from '../types/pdf-types';
import { PdfImageExtractorService } from './pdf-image-extractor.service';
import { QuestionParserService } from './question-parser.service';

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
      const { createdQuestions, totalAnswers, detectedQuestions } =
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
    contentParts: Array<{ content: string; contentType: ContentTypes }>,
    baseEntity: any,
    createBulk: (entities: any[]) => Promise<T[]>,
    updateBulk: (entities: T[]) => Promise<T[]>,
  ): Promise<T[]> {
    const entities = contentParts.map((part) => ({
      ...baseEntity,
      content: part.content,
      contentType: part.contentType,
    }));

    const savedEntities = await createBulk(entities);

    if (savedEntities.length > 1) {
      for (let index = 0; index < savedEntities.length - 1; index++) {
        savedEntities[index].nextContent = savedEntities[index + 1].id;
      }

      await updateBulk(savedEntities);
    }

    return savedEntities;
  }

  private async processPdfOnTheFly(
    pdfBuffer: Buffer,
    questionBankId: string,
  ): Promise<{
    createdQuestions: CreatedQuestionSummary[];
    totalAnswers: number;
    detectedQuestions: number;
  }> {
    try {
      const pdfjsLib: any = await import('pdfjs-dist/legacy/build/pdf.mjs');
      const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(pdfBuffer),
        ...PDF_PARSER_CONFIG.PDF_WORKER_OPTIONS,
      });

      const pdfDocument = await loadingTask.promise;
      const totalPages = pdfDocument.numPages ?? 0;

      this.logger.debug(`PDF loaded: ${totalPages} pages`);

      const createdQuestions: CreatedQuestionSummary[] = [];
      let totalAnswers = 0;
      let detectedQuestions = 0;
      let questionState: QuestionBlockState | null = null;

      for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
        try {
          const page = await pdfDocument.getPage(pageNumber);
          const pageContent = await this.extractPageContent(
            page,
            pageNumber,
            pdfjsLib,
          );

          const result = await this.questionParser.processPageContent(
            pageContent,
            questionState,
          );

          detectedQuestions += result.completedQuestions.length;

          for (const completedQuestion of result.completedQuestions) {
            const flushResult = await this.flushQuestionBlock(
              completedQuestion,
              questionBankId,
              createdQuestions,
            );
            totalAnswers += flushResult.totalAnswers;
          }

          questionState = result.questionState;
          totalAnswers += result.totalAnswers;

          this.logger.debug(`Page ${pageNumber} processed`);
        } catch (error) {
          throw new PdfParsingError(
            `Failed to process page: ${error}`,
            pageNumber,
          );
        }
      }

      await pdfDocument.destroy();

      // Flush remaining question
      if (questionState) {
        detectedQuestions++;
        const result = await this.flushQuestionBlock(
          questionState,
          questionBankId,
          createdQuestions,
        );
        totalAnswers += result.totalAnswers;
      }

      return { createdQuestions, totalAnswers, detectedQuestions };
    } catch (error) {
      if (error instanceof PdfParsingError) {
        throw error;
      }
      throw new PdfParsingError(`PDF processing failed: ${error}`);
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
    const questionParts =
      state.questionParts.length > 0
        ? state.questionParts
        : state.answerPartsList.length > 0
          ? [
              {
                content: '',
                contentType: ContentTypes.TEXT,
              },
            ]
          : [];

    if (questionParts.length === 0) {
      return { totalAnswers: 0 };
    }

    const resolvedQuestionType = this.questionParser.getQuestionType(
      state.answerPartsList.length,
    );

    const savedParts = await this.createContentChain(
      questionParts,
      { type: resolvedQuestionType },
      this.questionService.createBulk.bind(this.questionService),
      this.questionService.updateBulk.bind(this.questionService),
    );

    const rootQuestion = savedParts[0];

    let totalAnswers = 0;
    let answerCount = 0;

    for (const answerParts of state.answerPartsList) {
      const savedAnswerParts = await this.createContentChain(
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
}
