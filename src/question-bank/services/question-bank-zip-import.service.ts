import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Not, Repository } from 'typeorm';
import { AnswerEntity } from 'src/answer/answer.entity';
import { ContentTypes } from 'src/common/enum/content-type.enum';
import { QuestionEntity } from 'src/question/question.entity';
import { QuestionBankQuestionEntity } from 'src/question-bank-question/question-bank-question.entity';
import { QuestionBankSectionEntity } from 'src/question-bank-section/question-bank-section.entity';
import { FileType } from 'src/upload/enum/file-visibility.enum';
import { UploadService } from 'src/upload/upload.service';
import { ImportZipExamResultDto } from '../dto/import-exam.dto';
import { QuestionBankEntity } from '../question-bank.entity';
import {
  AnswerKeyOption,
  CreatedQuestionSummary,
  ImportedContentPart,
  ParsedDocumentResult,
  ParsedSection,
} from '../types/question-bank-import.types';
import {
  ImportedAudioFile,
  ImportedZipSection,
  ZipAudioEntry,
} from '../types/question-bank-zip-import.types';
import { ExamZipReaderService } from './exam-zip-reader.service';
import { QuestionBankImportService } from './question-bank-import.service';
import { StructuredExamParserService } from './structured-exam-parser.service';

@Injectable()
export class QuestionBankZipImportService {
  constructor(
    @InjectRepository(QuestionBankEntity)
    private readonly questionBankRepo: Repository<QuestionBankEntity>,
    private readonly entityManager: EntityManager,
    private readonly zipReader: ExamZipReaderService,
    private readonly pdfImportService: QuestionBankImportService,
    private readonly structuredParser: StructuredExamParserService,
    private readonly uploadService: UploadService,
  ) {}

  async importExamFromZip(
    questionBankId: string,
    zipBuffer: Buffer,
  ): Promise<ImportZipExamResultDto> {
    const existingBank = await this.questionBankRepo.findOne({
      where: { id: questionBankId },
    });
    if (!existingBank) {
      throw new NotFoundException(
        `Không tìm thấy ngân hàng câu hỏi ${questionBankId}`,
      );
    }

    const archive = await this.zipReader.inspect(zipBuffer);
    const pages = await this.pdfImportService.readRawPdfPages(
      archive.pdf.buffer,
    );
    const { document, sections } =
      await this.structuredParser.parsePages(pages);
    this.validateDocument(document);
    const audioBySectionOrder = this.matchAudioFiles(
      sections,
      archive.audioFiles,
      archive.warnings,
    );

    const newFilePaths: string[] = [];
    const oldFilePaths: string[] = [];
    const queryRunner = this.entityManager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const result = await this.replaceResources(
        queryRunner.manager,
        questionBankId,
        document,
        sections,
        audioBySectionOrder,
        newFilePaths,
        oldFilePaths,
      );
      await queryRunner.commitTransaction();

      await Promise.allSettled(
        [...new Set(oldFilePaths)].map((path) =>
          this.uploadService.deleteFileByPath(path),
        ),
      );

      return {
        ...result,
        warnings: archive.warnings,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      await Promise.allSettled(
        [...new Set(newFilePaths)].map((path) =>
          this.uploadService.deleteFileByPath(path),
        ),
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private validateDocument(document: ParsedDocumentResult): void {
    if (document.questions.length === 0) {
      throw new BadRequestException('PDF không có câu hỏi hợp lệ');
    }

    for (const question of document.questions) {
      const labels = question.answers.map((answer) => answer.label);
      const labelSet = new Set<string>(labels);
      if (
        labels.length !== 4 ||
        labelSet.size !== 4 ||
        !['A', 'B', 'C', 'D'].every((label) => labelSet.has(label))
      ) {
        throw new BadRequestException(
          `Câu ${question.number} phải có đủ bốn lựa chọn A, B, C, D`,
        );
      }
      if (!document.answerKey[question.number]) {
        throw new BadRequestException(`Câu ${question.number} thiếu ĐÁP ÁN`);
      }
      if (!['single_choice', 'multiple_choice'].includes(question.kind)) {
        throw new BadRequestException(
          `Câu ${question.number} có dạng không được hỗ trợ: ${question.kind}`,
        );
      }
    }
  }

  private matchAudioFiles(
    sections: ParsedSection[],
    audioFiles: ZipAudioEntry[],
    warnings: string[],
  ): Map<number, ZipAudioEntry> {
    const result = new Map<number, ZipAudioEntry>();
    const usedPaths = new Set<string>();

    for (const section of sections) {
      const audio = section.meta?.audio as { label?: string } | undefined;
      const rawFormat = section.meta?.questionFormat;
      const format =
        typeof rawFormat === 'string' ? rawFormat.toUpperCase() : '';
      if (format === 'LISTENING' && !audio?.label) {
        throw new BadRequestException(`${section.title} thiếu nhãn AUDIO`);
      }
      if (!audio?.label) {
        continue;
      }

      const normalizedLabel = this.zipReader.normalizeAudioLabel(audio.label);
      const matches = audioFiles.filter(
        (file) => file.normalizedLabel === normalizedLabel,
      );
      if (matches.length === 0) {
        throw new BadRequestException(
          `Không tìm thấy file audio cho nhãn "${audio.label}"`,
        );
      }
      if (matches.length > 1) {
        throw new BadRequestException(
          `Có nhiều file audio khớp nhãn "${audio.label}"`,
        );
      }
      result.set(section.orderNo, matches[0]);
      usedPaths.add(matches[0].path);
    }

    for (const audioFile of audioFiles) {
      if (!usedPaths.has(audioFile.path)) {
        warnings.push(`Audio không được PDF tham chiếu: ${audioFile.path}`);
      }
    }
    return result;
  }

  private async replaceResources(
    manager: EntityManager,
    questionBankId: string,
    document: ParsedDocumentResult,
    sections: ParsedSection[],
    audioBySectionOrder: Map<number, ZipAudioEntry>,
    newFilePaths: string[],
    oldFilePaths: string[],
  ): Promise<Omit<ImportZipExamResultDto, 'warnings'>> {
    const bankRepo = manager.getRepository(QuestionBankEntity);
    const linkRepo = manager.getRepository(QuestionBankQuestionEntity);
    const sectionRepo = manager.getRepository(QuestionBankSectionEntity);
    const questionRepo = manager.getRepository(QuestionEntity);
    const answerRepo = manager.getRepository(AnswerEntity);
    const bank = await bankRepo.findOne({
      where: { id: questionBankId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!bank) {
      throw new NotFoundException(
        `Không tìm thấy ngân hàng câu hỏi ${questionBankId}`,
      );
    }

    const oldLinks = await linkRepo.find({ where: { questionBankId } });
    const oldSections = await sectionRepo.find({ where: { questionBankId } });
    for (const section of oldSections) {
      const audio = section.meta?.audio as { path?: string } | undefined;
      if (audio?.path) oldFilePaths.push(audio.path);
    }

    const orphanQuestionIds: string[] = [];
    for (const rootId of [
      ...new Set(oldLinks.map((link) => link.questionId)),
    ]) {
      const otherReferenceCount = await linkRepo.count({
        where: { questionId: rootId, questionBankId: Not(questionBankId) },
      });
      if (otherReferenceCount === 0) {
        orphanQuestionIds.push(
          ...(await this.collectQuestionChainIds(questionRepo, rootId)),
        );
      }
    }

    if (orphanQuestionIds.length) {
      const oldQuestions = await questionRepo.find({
        where: { id: In(orphanQuestionIds) },
      });
      const oldAnswers = await answerRepo.find({
        where: { questionId: In(orphanQuestionIds) },
      });
      oldFilePaths.push(
        ...oldQuestions
          .filter((item) => item.contentType === ContentTypes.IMAGE)
          .map((item) => item.content),
        ...oldAnswers
          .filter((item) => item.contentType === ContentTypes.IMAGE)
          .map((item) => item.content),
      );
    }

    await linkRepo.delete({ questionBankId });
    await sectionRepo.delete({ questionBankId });
    if (orphanQuestionIds.length) {
      await questionRepo.delete({ id: In([...new Set(orphanQuestionIds)]) });
    }

    const persistedSections: ImportedZipSection[] = [];
    const audioFiles: ImportedAudioFile[] = [];
    const sectionIds = new Map<number, string>();
    for (const section of sections) {
      let meta = section.meta ?? {};
      const audioEntry = audioBySectionOrder.get(section.orderNo);
      let uploadedAudio: Awaited<
        ReturnType<UploadService['saveBufferAsFile']>
      > | null = null;
      if (audioEntry) {
        uploadedAudio = await this.uploadService.saveBufferAsFile(
          audioEntry.buffer,
          {
            originalName: audioEntry.originalName,
            mimetype: audioEntry.mimetype,
            uploadedBy: 'zip-import',
            fileType: FileType.NORMAL,
            description: `Audio imported for ${section.title}`,
            folderPath: `question-banks/${questionBankId}`,
            storedPathPrefix: '/uploads',
            manager,
          },
        );
        newFilePaths.push(uploadedAudio.path);
        const audioLabel = (meta.audio as { label?: string } | undefined)
          ?.label;
        meta = {
          ...meta,
          audio: {
            label: audioLabel,
            fileId: uploadedAudio.id,
            path: uploadedAudio.path,
            originalName: uploadedAudio.originalName,
            mimetype: uploadedAudio.mimetype,
            size: Number(uploadedAudio.size),
          },
        };
      }

      const saved = await sectionRepo.save(
        sectionRepo.create({
          questionBankId,
          title: section.title,
          instruction: section.instruction ?? null,
          orderNo: section.orderNo,
          meta,
        }),
      );
      sectionIds.set(section.orderNo, saved.id);
      persistedSections.push({
        id: saved.id,
        title: saved.title,
        instruction: saved.instruction,
        orderNo: saved.orderNo,
        meta: saved.meta,
      });
      if (uploadedAudio) {
        audioFiles.push({
          id: uploadedAudio.id,
          label: String((meta.audio as { label?: string }).label ?? ''),
          originalName: uploadedAudio.originalName,
          path: uploadedAudio.path,
          mimetype: uploadedAudio.mimetype,
          size: Number(uploadedAudio.size),
          sectionId: saved.id,
        });
      }
    }

    const points = this.calculatePoints(
      bank.totalMarks,
      document.questions.length,
    );
    const questions: CreatedQuestionSummary[] = [];
    let totalAnswers = 0;
    for (const parsed of document.questions) {
      const savedQuestions = await this.persistQuestionChain(
        manager,
        parsed.stemParts,
        parsed.questionType,
        questionBankId,
        newFilePaths,
      );
      const rootQuestion = savedQuestions[0];
      const correctLabel = document.answerKey[parsed.number];

      for (
        let answerIndex = 0;
        answerIndex < parsed.answers.length;
        answerIndex++
      ) {
        const answer = parsed.answers[answerIndex];
        const savedAnswers = await this.persistAnswerChain(
          manager,
          answer.parts,
          rootQuestion.id,
          answer.label,
          answer.label === correctLabel,
          answerIndex + 1,
          questionBankId,
          newFilePaths,
        );
        totalAnswers += savedAnswers.length;
      }

      await linkRepo.save(
        linkRepo.create({
          questionBankId,
          questionId: rootQuestion.id,
          sectionId: parsed.sectionOrderNo
            ? sectionIds.get(parsed.sectionOrderNo)
            : null,
          orderNo: parsed.number,
          points,
        }),
      );
      questions.push({
        id: rootQuestion.id,
        content: rootQuestion.content,
        type: rootQuestion.type,
        contentType: rootQuestion.contentType,
        answerCount: parsed.answers.length,
      });
    }

    bank.totalQuestions = document.questions.length;
    await bankRepo.save(bank);

    return {
      totalQuestions: document.questions.length,
      totalAnswers,
      questions,
      answerKey: this.serializeAnswerKey(document.answerKey),
      sections: persistedSections,
      audioFiles,
    };
  }

  private async persistQuestionChain(
    manager: EntityManager,
    parts: ImportedContentPart[],
    type: QuestionEntity['type'],
    questionBankId: string,
    newFilePaths: string[],
  ): Promise<QuestionEntity[]> {
    const repo = manager.getRepository(QuestionEntity);
    const entities: QuestionEntity[] = [];
    for (let index = 0; index < parts.length; index++) {
      const content = await this.persistContentPart(
        manager,
        parts[index],
        questionBankId,
        newFilePaths,
        `question-${index + 1}`,
      );
      entities.push(
        await repo.save(
          repo.create({
            type,
            contentType: parts[index].contentType,
            content,
            meta: parts[index].meta,
            isRoot: index === 0,
          }),
        ),
      );
    }
    for (let index = 0; index < entities.length - 1; index++) {
      entities[index].nextContent = entities[index + 1].id;
      await repo.save(entities[index]);
    }
    return entities;
  }

  private async persistAnswerChain(
    manager: EntityManager,
    parts: ImportedContentPart[],
    questionId: string,
    label: string,
    isCorrect: boolean,
    orderNo: number,
    questionBankId: string,
    newFilePaths: string[],
  ): Promise<AnswerEntity[]> {
    const repo = manager.getRepository(AnswerEntity);
    const entities: AnswerEntity[] = [];
    for (let index = 0; index < parts.length; index++) {
      const content = await this.persistContentPart(
        manager,
        parts[index],
        questionBankId,
        newFilePaths,
        `answer-${label}-${index + 1}`,
      );
      entities.push(
        await repo.save(
          repo.create({
            questionId,
            contentType: parts[index].contentType,
            content,
            meta:
              index === 0
                ? { ...(parts[index].meta ?? {}), importOptionLabel: label }
                : parts[index].meta,
            isCorrect: index === 0 && isCorrect,
            orderNo,
          }),
        ),
      );
    }
    for (let index = 0; index < entities.length - 1; index++) {
      entities[index].nextContent = entities[index + 1].id;
      await repo.save(entities[index]);
    }
    return entities;
  }

  private async persistContentPart(
    manager: EntityManager,
    part: ImportedContentPart,
    questionBankId: string,
    newFilePaths: string[],
    name: string,
  ): Promise<string> {
    if (part.contentType !== ContentTypes.IMAGE) {
      return String(part.content);
    }
    const buffer = Buffer.isBuffer(part.content)
      ? part.content
      : Buffer.from(String(part.content), 'base64');
    const uploaded = await this.uploadService.saveBufferAsFile(buffer, {
      originalName: `${name}.png`,
      mimetype: 'image/png',
      uploadedBy: 'zip-import',
      fileType: FileType.NORMAL,
      description: 'Image generated from ZIP PDF import',
      folderPath: `question-banks/${questionBankId}`,
      storedPathPrefix: '/uploads',
      manager,
    });
    newFilePaths.push(uploaded.path);
    return uploaded.path;
  }

  private async collectQuestionChainIds(
    repo: Repository<QuestionEntity>,
    rootId: string,
  ): Promise<string[]> {
    const ids: string[] = [];
    const visited = new Set<string>();
    let currentId: string | undefined = rootId;
    while (currentId && !visited.has(currentId)) {
      const entity = await repo.findOne({ where: { id: currentId } });
      if (!entity) break;
      ids.push(entity.id);
      visited.add(entity.id);
      currentId = entity.nextContent;
    }
    return ids;
  }

  private calculatePoints(
    totalMarks: number | undefined,
    count: number,
  ): number {
    const marks = Number(totalMarks ?? 0);
    return count > 0 && Number.isFinite(marks) && marks > 0 ? marks / count : 1;
  }

  private serializeAnswerKey(
    answerKey: Record<number, AnswerKeyOption>,
  ): Record<string, AnswerKeyOption> {
    return Object.fromEntries(
      Object.entries(answerKey).map(([number, answer]) => [
        String(number),
        answer,
      ]),
    );
  }
}
