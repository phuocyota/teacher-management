import * as fs from 'fs';
import { QuestionBankImportService } from '../src/question-bank/services/question-bank-import.service';
import { PdfImageExtractorService } from '../src/question-bank/services/pdf-image-extractor.service';
import { QuestionParserService } from '../src/question-bank/services/question-parser.service';

async function main(): Promise<void> {
  const service = new QuestionBankImportService(
    { findOne: async () => ({ id: 'qb-1' }), save: async (value: any) => value } as any,
    { create: (value: any) => value, save: async (value: any) => value, count: async () => 0 } as any,
    {
      createBulk: async (entities: any[]) =>
        entities.map((entity, index) => ({ id: `q-${Date.now()}-${index}`, ...entity })),
      updateBulk: async (entities: any[]) => entities,
    } as any,
    {
      createBulk: async (entities: any[]) =>
        entities.map((entity, index) => ({ id: `a-${Date.now()}-${index}`, ...entity })),
      updateBulk: async (entities: any[]) => entities,
    } as any,
    new PdfImageExtractorService(),
    new QuestionParserService(),
  );

  const pdfBuffer = fs.readFileSync('tmp/kns-khoi-1-hkii.pdf');
  const started = Date.now();
  const result = await (service as any).processPdfOnTheFly(pdfBuffer, 'qb-1');

  console.log(
    JSON.stringify(
      {
        ms: Date.now() - started,
        createdQuestions: result.createdQuestions.length,
        totalAnswers: result.totalAnswers,
        detectedQuestions: result.detectedQuestions,
        answerKeyCount: Object.keys(result.answerKey || {}).length,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
