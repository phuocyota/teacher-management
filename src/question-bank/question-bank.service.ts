import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QuestionBankEntity } from './question-bank.entity';
import {
  CreateQuestionBankDto,
  UpdateQuestionBankDto,
} from './dto/create-question-bank.dto';
import { ClassService } from 'src/class/class.service';
import {
  ERROR_MESSAGES,
  ENTITY_NAMES,
} from 'src/common/constant/error-messages.constant';
import { PaginationResponseDto } from 'src/common/dto/pagination.dto';
import { QuestionBankResponseDto } from './dto/question-bank.dto';
import { autoMapListToDto, autoMapToDto } from 'src/common/utils/auto-map.util';
import { QuestionService } from 'src/question/question.service';
import { AnswerService } from 'src/answer/answer.service';
import { QuestionEntity } from 'src/question/question.entity';
import { AnswerEntity } from 'src/answer/answer.entity';
import { ContentTypes } from 'src/common/enum/content-type.enum';
import { ImportExamResultDto, ParsedQuestion } from './dto/import-exam.dto';
import { QuestionResponseDto } from 'src/question/dto/question.dto';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class QuestionBankService {
  constructor(
    @InjectRepository(QuestionBankEntity)
    private readonly questionBankRepo: Repository<QuestionBankEntity>,
    private readonly classService: ClassService,
    @Inject(forwardRef(() => QuestionService))
    private readonly questionService: QuestionService,
    @Inject(forwardRef(() => AnswerService))
    private readonly answerService: AnswerService,
  ) {}

  async create(dto: CreateQuestionBankDto): Promise<QuestionBankEntity> {
    // Validate classId exists
    const cls = await this.classService.findOne(dto.classId);

    const record = this.questionBankRepo.create({
      totalMarks: dto.totalMarks,
      examDate: dto.examDate,
      class: cls,
    });
    return this.questionBankRepo.save(record);
  }

  async findAll(
    page = 1,
    size = 10,
    classId?: string,
    examDate?: string,
  ): Promise<PaginationResponseDto<QuestionBankResponseDto>> {
    const skip = (page - 1) * size;

    const qb = this.questionBankRepo
      .createQueryBuilder('qb')
      .leftJoinAndSelect('qb.class', 'class');

    if (classId) {
      qb.andWhere('qb.class_id = :classId', { classId });
    }

    if (examDate) {
      qb.andWhere('qb.exam_date = :examDate', { examDate });
    }

    qb.orderBy('qb.examDate', 'DESC');
    qb.skip(skip).take(size);

    const [data, total] = await qb.getManyAndCount();

    return {
      data: autoMapListToDto(QuestionBankResponseDto, data),
      page,
      size,
      total,
    };
  }

  async findOne(id: string): Promise<QuestionBankEntity> {
    const record = await this.questionBankRepo.findOne({
      where: { id },
      relations: ['class'],
    });
    if (!record) {
      throw new NotFoundException(
        ERROR_MESSAGES.NOT_FOUND_WITH_ID(ENTITY_NAMES.QUESTION_BANK, id),
      );
    }
    return record;
  }

  async update(
    id: string,
    dto: UpdateQuestionBankDto,
  ): Promise<QuestionBankEntity> {
    const record = await this.findOne(id);

    if (dto.classId) {
      const cls = await this.classService.findOne(dto.classId);
      record.class = cls;
    }

    if (dto.totalMarks !== undefined) {
      record.totalMarks = dto.totalMarks;
    }

    if (dto.examDate !== undefined) {
      record.examDate = dto.examDate;
    }

    return this.questionBankRepo.save(record);
  }

  async remove(id: string): Promise<void> {
    const record = await this.findOne(id);
    await this.questionBankRepo.remove(record);
  }

  async importExamFromPdf(
    questionBankId: string,
    pdfBuffer: Buffer,
  ): Promise<ImportExamResultDto> {
    // Validate question bank exists
    const questionBank = await this.findOne(questionBankId);

    try {
      // Parse PDF - using dynamic require to avoid TypeScript issues
      const pdfParser = require('pdf-parse');
      const PDFDocument = require('pdf-lib').PDFDocument;

      // Extract text from PDF
      const pdfData: any = await pdfParser(pdfBuffer);
      const text: string = pdfData.text;

      // Extract images from PDF using pdf-lib
      const pdfDoc = await PDFDocument.load(pdfBuffer);
      const extractedImages = await this.extractImagesFromPdf(
        pdfDoc,
        questionBankId,
      );

      // Parse questions from text and images
      const parsedQuestions = await this.parseExamWithImages(
        text,
        extractedImages,
      );

      if (parsedQuestions.length === 0) {
        throw new BadRequestException(
          'Không tìm thấy câu hỏi nào trong file PDF',
        );
      }

      // Save questions and answers
      const createdQuestions: Array<{
        id: string;
        content: string;
        contentType: ContentTypes;
        answerCount: number;
      }> = [];
      let totalAnswers = 0;

      for (const parsedQ of parsedQuestions) {
        // Create question
        const question: Partial<QuestionEntity> = {
          content: parsedQ.content,
          contentType: parsedQ.contentType,
          questionBank: questionBank,
          questionBankId: questionBank.id,
        };
        const [savedQuestion] = await this.questionService.createBulk([
          question,
        ]);

        // Create answers
        const answers: Partial<AnswerEntity>[] = parsedQ.answers.map(
          (answer) => ({
            content: answer.content,
            contentType: answer.contentType,
            question: savedQuestion,
            questionId: savedQuestion.id,
          }),
        );
        const savedAnswers = await this.answerService.createBulk(answers);

        // Map entity to DTO and add answerCount
        const questionDto = autoMapToDto(QuestionResponseDto, savedQuestion);
        createdQuestions.push({
          id: questionDto.id,
          content: questionDto.content,
          contentType: questionDto.contentType,
          answerCount: savedAnswers.length,
        });
        totalAnswers += savedAnswers.length;
      }

      return {
        totalQuestions: createdQuestions.length,
        totalAnswers,
        questions: createdQuestions,
      };
    } catch (error) {
      throw new BadRequestException(`Lỗi khi parse PDF: ${error}`);
    }
  }

  private parseExamText(text: string): ParsedQuestion[] {
    const questions: ParsedQuestion[] = [];

    // Split by question pattern: "Câu 1:", "Câu 2:", etc or "Question 1:", etc
    const questionPattern =
      /(?:Câu|Question)\s*(\d+)[:\.]?\s*(.*?)(?=(?:Câu|Question)\s*\d+|$)/gis;
    const matches = [...text.matchAll(questionPattern)];

    for (const match of matches) {
      const questionNumber = match[1];
      const questionContent = match[2].trim();

      if (!questionContent) continue;

      // Extract question text and answers
      // Pattern for answers: A., B., C., D. or A), B), C), D)
      const answerPattern = /[A-D][\.\)]\s*([^\n]+)/gi;
      const answerMatches = [...questionContent.matchAll(answerPattern)];

      if (answerMatches.length === 0) {
        // No multiple choice answers found, treat entire content as question
        questions.push({
          content: questionContent,
          contentType: ContentTypes.TEXT,
          answers: [],
        });
        continue;
      }

      // Extract the question text (before first answer)
      const firstAnswerIndex = questionContent.search(/[A-D][\.\)]/i);
      const questionText = questionContent
        .substring(0, firstAnswerIndex)
        .trim();

      // Extract answers
      const answers = answerMatches.map((m) => ({
        content: m[1].trim(),
        contentType: ContentTypes.TEXT,
      }));

      if (questionText && answers.length > 0) {
        questions.push({
          content: `Câu ${questionNumber}: ${questionText}`,
          contentType: ContentTypes.TEXT,
          answers,
        });
      }
    }

    return questions;
  }

  /**
   * Extract images from PDF and save to uploads folder
   */
  private async extractImagesFromPdf(
    pdfDoc: any,
    questionBankId: string,
  ): Promise<Map<number, string[]>> {
    const imagesByPage = new Map<number, string[]>();
    const uploadsDir = path.join(
      process.cwd(),
      'uploads',
      'question-banks',
      questionBankId,
    );

    // Create directory if not exists
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    try {
      const pages = pdfDoc.getPages();

      for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
        const page = pages[pageIndex];
        const pageImages: string[] = [];

        try {
          // Get resources from page
          const resources = page.node.Resources();
          if (!resources) continue;

          const xObjects = resources.lookup(
            require('pdf-lib').PDFName.of('XObject'),
          );
          if (!xObjects) continue;

          const xObjectKeys = xObjects.dict.keys();

          for (const key of xObjectKeys) {
            try {
              const xObject = xObjects.lookup(key);
              if (!xObject) continue;

              const subtype = xObject.dict.lookup(
                require('pdf-lib').PDFName.of('Subtype'),
              );
              if (subtype?.toString() !== '/Image') continue;

              // Extract image data
              const imageData = xObject.contents;
              if (!imageData) continue;

              // Generate unique filename
              const imageId = uuidv4();
              const imagePath = path.join(uploadsDir, `${imageId}.png`);
              const relativeImagePath = `/uploads/question-banks/${questionBankId}/${imageId}.png`;

              // Save image using sharp for conversion
              const sharp = require('sharp');
              await sharp(Buffer.from(imageData)).png().toFile(imagePath);

              pageImages.push(relativeImagePath);
            } catch (imgError) {
              console.error(
                `Error extracting image from page ${pageIndex}:`,
                imgError,
              );
            }
          }
        } catch (pageError) {
          console.error(`Error processing page ${pageIndex}:`, pageError);
        }

        if (pageImages.length > 0) {
          imagesByPage.set(pageIndex, pageImages);
        }
      }
    } catch (error) {
      console.error('Error extracting images from PDF:', error);
    }

    return imagesByPage;
  }

  /**
   * Parse exam text with image support
   * Format: Câu X ... ? (question ends with ?)
   * Then A. B. C. D. (answers)
   */
  private async parseExamWithImages(
    text: string,
    imagesByPage: Map<number, string[]>,
  ): Promise<ParsedQuestion[]> {
    const questions: ParsedQuestion[] = [];

    // Get all images in order
    const allImages: string[] = [];
    imagesByPage.forEach((images) => allImages.push(...images));

    let imageIndex = 0;

    // Pattern: "Câu X" to "?" marks question end
    const questionPattern =
      /(?:Câu|Question)\s*(\d+)[:\.]?\s*(.*?)(?=(?:Câu|Question)\s*\d+|$)/gis;
    const matches = [...text.matchAll(questionPattern)];

    for (const match of matches) {
      const questionNumber = match[1];
      let questionContent = match[2].trim();

      if (!questionContent) {
        // Pure image question
        if (imageIndex < allImages.length) {
          questions.push({
            content: allImages[imageIndex++],
            contentType: ContentTypes.IMAGE,
            answers: [],
          });
        }
        continue;
      }

      // Find question end (?)
      const questionEndIndex = questionContent.indexOf('?');
      let questionText = '';
      let remainingText = questionContent;

      if (questionEndIndex !== -1) {
        questionText = questionContent
          .substring(0, questionEndIndex + 1)
          .trim();
        remainingText = questionContent.substring(questionEndIndex + 1).trim();
      }

      // Check if question has image marker or very short text (likely image)
      let questionContentType = ContentTypes.TEXT;
      let finalQuestionContent = `Câu ${questionNumber}: ${questionText}`;

      if (!questionText || questionText.length < 10) {
        // Likely an image question
        if (imageIndex < allImages.length) {
          finalQuestionContent = allImages[imageIndex++];
          questionContentType = ContentTypes.IMAGE;
        }
      }

      // Extract answers
      const answerPattern = /([A-D])[\.\)]\s*([^\n]+)/gi;
      const answerMatches = [...remainingText.matchAll(answerPattern)];

      const answers = answerMatches.map((m) => {
        const answerText = m[2].trim();

        // Check if answer is likely an image (very short text or special markers)
        if (answerText.length < 5 && imageIndex < allImages.length) {
          return {
            content: allImages[imageIndex++],
            contentType: ContentTypes.IMAGE,
          };
        }

        return {
          content: answerText,
          contentType: ContentTypes.TEXT,
        };
      });

      questions.push({
        content: finalQuestionContent,
        contentType: questionContentType,
        answers,
      });
    }

    return questions;
  }
}
