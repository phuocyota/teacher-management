import * as fs from 'fs';
import { PDF_PARSER_CONFIG } from '../src/question-bank/constants/pdf-parser.constant';
import { PdfImageExtractorService } from '../src/question-bank/services/pdf-image-extractor.service';
import { QuestionParserService } from '../src/question-bank/services/question-parser.service';
import { PageContent } from '../src/question-bank/types/question-bank-import.types';

async function extractPageContent(
  page: any,
  pageNumber: number,
  pdfjsLib: any,
  pdfImageExtractor: PdfImageExtractorService,
): Promise<PageContent> {
  const viewport = page.getViewport({ scale: 1 });
  const [textContent, imageFragments] = await Promise.all([
    page.getTextContent({
      normalizeWhitespace: true,
      disableCombineTextItems: false,
    }),
    pdfImageExtractor.extractPageImages(page, pageNumber, pdfjsLib, viewport),
  ]);

  const textFragments: any[] = [];
  let order = 0;

  for (const item of textContent.items as any[]) {
    const content = typeof item.str === 'string' ? item.str.trim() : '';

    if (!content) {
      continue;
    }

    const transform = pdfjsLib.Util.transform(viewport.transform, item.transform);
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

  const allFragments = [...textFragments, ...imageFragments].sort((left, right) => {
    const verticalDelta = left.y - right.y;

    if (Math.abs(verticalDelta) > PDF_PARSER_CONFIG.LINE_TOLERANCE) {
      return verticalDelta;
    }

    const horizontalDelta = left.x - right.x;

    if (Math.abs(horizontalDelta) > PDF_PARSER_CONFIG.HORIZONTAL_DELTA_THRESHOLD) {
      return horizontalDelta;
    }

    return left.order - right.order;
  });

  const lines: any[] = [];

  for (const fragment of allFragments) {
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

  return {
    pageNumber,
    lines: lines.map((line) => ({
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
    })),
  };
}

async function main(): Promise<void> {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const pdfImageExtractor = new PdfImageExtractorService();
  const questionParser = new QuestionParserService();
  const pdfBuffer = fs.readFileSync('tmp/kns-khoi-1-hkii.pdf');
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(pdfBuffer),
    ...PDF_PARSER_CONFIG.PDF_WORKER_OPTIONS,
  });
  const pdfDocument = await loadingTask.promise;

  let parserState: any = null;
  let completedQuestions = 0;
  const started = Date.now();

  for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber++) {
    const pageStarted = Date.now();
    const page = await pdfDocument.getPage(pageNumber);
    const pageContent = await extractPageContent(
      page,
      pageNumber,
      pdfjsLib,
      pdfImageExtractor,
    );
    const result = await questionParser.processPageContent(pageContent, parserState);
    parserState = result.parserState;
    completedQuestions += result.completedQuestions.length;

    console.log(
      JSON.stringify({
        pageNumber,
        ms: Date.now() - pageStarted,
        lines: pageContent.lines.length,
        completedQuestions: result.completedQuestions.length,
        openQuestion: parserState?.currentQuestion?.number ?? null,
      }),
    );
  }

  await pdfDocument.destroy();

  console.log(
    JSON.stringify({
      totalMs: Date.now() - started,
      pages: pdfDocument.numPages,
      completedQuestions,
      finalOpenQuestion: parserState?.currentQuestion?.number ?? null,
      answerKeyCount: Object.keys(parserState?.answerKey ?? {}).length,
    }),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
