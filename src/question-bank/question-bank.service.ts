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
import { autoMapListToDto } from 'src/common/utils/auto-map.util';
import { QuestionService } from 'src/question/question.service';
import { AnswerService } from 'src/answer/answer.service';
import { ContentTypes } from 'src/common/enum/content-type.enum';
import { ImportExamResultDto, ParsedQuestion } from './dto/import-exam.dto';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import * as pdfLib from 'pdf-lib';

interface ImageWithPosition {
  path: string;
  page: number;
  width?: number;
  height?: number;
}

interface PdfData {
  text: string;
  numpages: number;
}

interface CreatedQuestionSummary {
  id: string;
  content: string;
  contentType: ContentTypes;
  answerCount: number;
}

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

  /**
   * Tạo chuỗi nội dung cho câu hỏi hoặc câu trả lời
   * Xử lý cả single và multiple parts với nextContent linking
   */
  private async createContentChain<
    T extends { id: string; nextContent?: string },
  >(
    contentParts: Array<{ content: string; contentType: ContentTypes }>,
    baseEntity: any,
    createBulk: (entities: any[]) => Promise<T[]>,
    updateBulk: (entities: T[]) => Promise<T[]>,
  ): Promise<T[]> {
    // Create all parts
    const entities = contentParts.map((part) => ({
      ...baseEntity,
      content: part.content,
      contentType: part.contentType,
    }));

    const savedEntities = await createBulk(entities);

    // Link chain if multiple parts
    if (savedEntities.length > 1) {
      for (let i = 0; i < savedEntities.length - 1; i++) {
        savedEntities[i].nextContent = savedEntities[i + 1].id;
      }
      await updateBulk(savedEntities);
    }

    return savedEntities;
  }

  async importExamFromPdf(
    questionBankId: string,
    pdfBuffer: Buffer,
  ): Promise<ImportExamResultDto> {
    // Validate question bank exists
    const questionBank = await this.findOne(questionBankId);

    try {
      // Parse PDF
      const PDFDocument = pdfLib.PDFDocument;

      // Extract text from PDF
      const pdfParserModule = await import('pdf-parse');
      const pdfParserFn = pdfParserModule as any;
      const pdfData: PdfData = await pdfParserFn(pdfBuffer);
      const text = pdfData.text;
      const numPages = pdfData.numpages;

      console.log(`PDF Import Info: ${numPages} pages detected`);

      // Extract images from PDF
      const pdfDoc = await PDFDocument.load(pdfBuffer);
      const extractedImages = await this.extractImagesFromPdf(
        pdfDoc,
        questionBankId,
      );

      // Parse and create questions/answers on-the-fly
      const { createdQuestions, totalAnswers } =
        await this.parseAndCreateFromPdf(text, extractedImages, questionBank);

      console.log(
        `Created ${createdQuestions.length} questions with ${totalAnswers} answers`,
      );

      return {
        totalQuestions: createdQuestions.length,
        totalAnswers,
        questions: createdQuestions,
      };
    } catch (error) {
      throw new BadRequestException(`Lỗi khi parse PDF: ${error}`);
    }
  }

  /**
   * Trích xuất hình ảnh từ PDF cùng thông tin vị trí
   */
  private async extractImagesFromPdf(
    pdfDoc: any,
    questionBankId: string,
  ): Promise<ImageWithPosition[]> {
    const imagesWithPosition: ImageWithPosition[] = [];
    const uploadsDir = path.join(
      process.cwd(),
      'uploads',
      'question-banks',
      questionBankId,
    );

    // Tạo thư mục nếu chưa tồn tại
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    try {
      const pages = pdfDoc.getPages();
      console.log(`Extracting images from ${pages.length} pages...`);

      // Duyệt qua từng trang trong PDF
      for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
        const page = pages[pageIndex];

        try {
          // Truy cập resources của trang (fonts, images, etc.)
          const resources = page.node.Resources();
          if (!resources) continue;

          // Lấy XObject dictionary (chứa images và forms)
          const xObjects = resources.lookup(
            require('pdf-lib').PDFName.of('XObject'),
          );
          if (!xObjects) continue;

          const xObjectKeys = xObjects.dict.keys();
          let imageIndexInPage = 0;

          // Xử lý từng XObject trong trang
          for (const key of xObjectKeys) {
            try {
              const xObject = xObjects.lookup(key);
              if (!xObject) continue;

              // Kiểm tra xem XObject có phải là image không (không phải form)
              const subtype = xObject.dict.lookup(
                require('pdf-lib').PDFName.of('Subtype'),
              );
              if (subtype?.toString() !== '/Image') continue;

              // Lấy dữ liệu ảnh thô từ PDF
              const imageData = xObject.contents;
              if (!imageData) continue;

              // Tạo tên file duy nhất cho ảnh
              const imageId = uuidv4();
              const imagePath = path.join(uploadsDir, `${imageId}.png`);
              const relativeImagePath = `/uploads/question-banks/${questionBankId}/${imageId}.png`;

              // Convert và lưu ảnh dưới dạng PNG bằng Sharp
              const sharp = require('sharp');
              const sharpInstance = sharp(Buffer.from(imageData));
              await sharpInstance.png().toFile(imagePath);

              // Lấy kích thước thực tế từ ảnh đã convert
              const metadata = await sharpInstance.metadata();
              const imageWidth = metadata.width || 100;
              const imageHeight = metadata.height || 100;

              // Lưu ảnh theo thứ tự xuất hiện
              imagesWithPosition.push({
                path: relativeImagePath,
                page: pageIndex,
                width: imageWidth,
                height: imageHeight,
              });

              imageIndexInPage++;
            } catch (imgError) {
              console.error(
                `Error extracting image from page ${pageIndex}:`,
                imgError,
              );
            }
          }

          if (imageIndexInPage > 0) {
            console.log(
              `Page ${pageIndex + 1}: Extracted ${imageIndexInPage} images`,
            );
          }
        } catch (pageError) {
          console.error(`Error processing page ${pageIndex}:`, pageError);
        }
      }

      console.log(`Total: ${imagesWithPosition.length} images extracted`);
    } catch (error) {
      console.error('Error extracting images from PDF:', error);
    }

    return imagesWithPosition;
  }

  /**
   * Parse PDF and create questions/answers on-the-fly
   * When "?" is detected, create question chain immediately, then parse and create answers
   */
  private async parseAndCreateFromPdf(
    text: string,
    imagesWithPosition: ImageWithPosition[],
    questionBank: QuestionBankEntity,
  ): Promise<{
    createdQuestions: CreatedQuestionSummary[];
    totalAnswers: number;
  }> {
    const createdQuestions: CreatedQuestionSummary[] = [];
    let totalAnswers = 0;

    // Parse questions from text
    const questionPattern =
      /(?:Câu|Question)\s*(\d+)[:\.]?\s*(.*?)(?=(?:Câu|Question)\s*\d+|$)/gis;
    const matches = [...text.matchAll(questionPattern)];

    if (matches.length === 0) {
      return { createdQuestions, totalAnswers };
    }

    console.log(
      `Parsing ${matches.length} questions with ${imagesWithPosition.length} images`,
    );

    // Group images by page
    const imagesByPage = new Map<number, ImageWithPosition[]>();
    for (const img of imagesWithPosition) {
      if (!imagesByPage.has(img.page)) {
        imagesByPage.set(img.page, []);
      }
      imagesByPage.get(img.page)!.push(img);
    }

    const questionsPerPage = Math.ceil(matches.length / imagesByPage.size);
    let globalImageIndex = 0;
    const allImagesFlattened = imagesWithPosition.map((img) => img.path);
    const imageMarkerPattern = /(\[IMG\]|\(hình\)|\[ảnh\]|\[image\])/gi;

    for (let qIndex = 0; qIndex < matches.length; qIndex++) {
      const match = matches[qIndex];
      const questionNumber = match[1];
      let questionContent = match[2].trim();

      const estimatedPage = Math.floor(qIndex / questionsPerPage);
      const pageImages = imagesByPage.get(estimatedPage) || [];

      if (!questionContent) {
        if (globalImageIndex < allImagesFlattened.length) {
          const savedParts = await this.createContentChain(
            [
              {
                content: allImagesFlattened[globalImageIndex++],
                contentType: ContentTypes.IMAGE,
              },
            ],
            { questionBank, questionBankId: questionBank.id },
            this.questionService.createBulk.bind(this.questionService),
            this.questionService.updateBulk.bind(this.questionService),
          );

          createdQuestions.push({
            id: savedParts[0].id,
            content: (savedParts[0] as any).content,
            contentType: (savedParts[0] as any).contentType,
            answerCount: 0,
          });
        }
        continue;
      }

      // Find question end (?)
      const questionEndIndex = questionContent.indexOf('?');
      if (questionEndIndex === -1) continue;

      const questionText = questionContent
        .substring(0, questionEndIndex + 1)
        .trim();
      const remainingText = questionContent
        .substring(questionEndIndex + 1)
        .trim();

      // Parse question content parts
      const contentParts: { content: string; contentType: ContentTypes }[] = [];
      const markers = questionText.match(imageMarkerPattern);
      const hasImageMarkers = markers && markers.length > 0;

      if (hasImageMarkers) {
        const parts = questionText
          .split(imageMarkerPattern)
          .filter((p) => p && p.trim());

        for (const part of parts) {
          const trimmedPart = part.trim();

          if (/\[IMG\]|\(hình\)|\[ảnh\]|\[image\]/i.test(trimmedPart)) {
            if (
              pageImages.length > 0 &&
              globalImageIndex < allImagesFlattened.length
            ) {
              const pageImageIndex = globalImageIndex % pageImages.length;
              contentParts.push({
                content:
                  pageImages[pageImageIndex]?.path ||
                  allImagesFlattened[globalImageIndex],
                contentType: ContentTypes.IMAGE,
              });
            } else if (globalImageIndex < allImagesFlattened.length) {
              contentParts.push({
                content: allImagesFlattened[globalImageIndex],
                contentType: ContentTypes.IMAGE,
              });
            }
            globalImageIndex++;
          } else if (trimmedPart.length > 0) {
            contentParts.push({
              content: `Câu ${questionNumber}: ${trimmedPart}`,
              contentType: ContentTypes.TEXT,
            });
          }
        }
      } else {
        if (!questionText || questionText.length < 10) {
          if (globalImageIndex < allImagesFlattened.length) {
            contentParts.push({
              content: allImagesFlattened[globalImageIndex++],
              contentType: ContentTypes.IMAGE,
            });
          }
        } else {
          contentParts.push({
            content: `Câu ${questionNumber}: ${questionText}`,
            contentType: ContentTypes.TEXT,
          });
        }
      }

      if (contentParts.length === 0) {
        contentParts.push({
          content: `Câu ${questionNumber}: ${questionText}`,
          contentType: ContentTypes.TEXT,
        });
      }

      // Create question chain
      const savedParts = await this.createContentChain(
        contentParts,
        { questionBank, questionBankId: questionBank.id },
        this.questionService.createBulk.bind(this.questionService),
        this.questionService.updateBulk.bind(this.questionService),
      );

      // Root question for answers
      const rootQuestion = savedParts[0];

      // Parse and create answers
      const answerPattern = /([A-D])[\.\)]\s*([^\n]+)/gi;
      const answerMatches = [...remainingText.matchAll(answerPattern)];
      let answerCount = 0;

      for (const answerMatch of answerMatches) {
        const answerText = answerMatch[2].trim();

        // Parse answer content parts
        const answerParts: { content: string; contentType: ContentTypes }[] =
          [];
        const answerMarkers = answerText.match(imageMarkerPattern);
        const hasAnswerMarkers = answerMarkers && answerMarkers.length > 0;

        if (hasAnswerMarkers) {
          const answerPartsSplit = answerText
            .split(imageMarkerPattern)
            .filter((p) => p && p.trim());

          for (const part of answerPartsSplit) {
            const trimmedPart = part.trim();

            if (/\[IMG\]|\(hình\)|\[ảnh\]|\[image\]/i.test(trimmedPart)) {
              if (globalImageIndex < allImagesFlattened.length) {
                answerParts.push({
                  content: allImagesFlattened[globalImageIndex++],
                  contentType: ContentTypes.IMAGE,
                });
              }
            } else if (trimmedPart.length > 0) {
              answerParts.push({
                content: trimmedPart,
                contentType: ContentTypes.TEXT,
              });
            }
          }
        } else {
          if (
            answerText.length < 5 &&
            globalImageIndex < allImagesFlattened.length
          ) {
            answerParts.push({
              content: allImagesFlattened[globalImageIndex++],
              contentType: ContentTypes.IMAGE,
            });
          } else {
            answerParts.push({
              content: answerText,
              contentType: ContentTypes.TEXT,
            });
          }
        }

        if (answerParts.length > 0) {
          // Create answer chain linked to root question
          const savedAnswerParts = await this.createContentChain(
            answerParts,
            { question: rootQuestion, questionId: rootQuestion.id },
            this.answerService.createBulk.bind(this.answerService),
            this.answerService.updateBulk.bind(this.answerService),
          );

          totalAnswers += savedAnswerParts.length;
          answerCount++;
        }
      }

      createdQuestions.push({
        id: rootQuestion.id,
        content: (rootQuestion as any).content,
        contentType: (rootQuestion as any).contentType,
        answerCount,
      });
    }

    console.log(`Successfully created ${createdQuestions.length} questions`);
    return { createdQuestions, totalAnswers };
  }

  /**
   * @deprecated - No longer used, replaced by parseAndCreateFromPdf
   */
  private async parseExamWithImages(
    text: string,
    imagesWithPosition: ImageWithPosition[],
  ): Promise<ParsedQuestion[]> {
    const questions: ParsedQuestion[] = [];

    // Parse questions from text
    const questionPattern =
      /(?:Câu|Question)\s*(\d+)[:\.]?\s*(.*?)(?=(?:Câu|Question)\s*\d+|$)/gis;
    const matches = [...text.matchAll(questionPattern)];

    if (matches.length === 0) {
      return questions;
    }

    console.log(
      `Parsing ${matches.length} questions with ${imagesWithPosition.length} images`,
    );

    // Group images by page for easier lookup
    const imagesByPage = new Map<number, ImageWithPosition[]>();
    for (const img of imagesWithPosition) {
      if (!imagesByPage.has(img.page)) {
        imagesByPage.set(img.page, []);
      }
      imagesByPage.get(img.page)!.push(img);
    }

    // Estimate which page each question is on based on question number
    const questionsPerPage = Math.ceil(matches.length / imagesByPage.size);
    let globalImageIndex = 0;
    const allImagesFlattened = imagesWithPosition.map((img) => img.path);

    for (let qIndex = 0; qIndex < matches.length; qIndex++) {
      const match = matches[qIndex];
      const questionNumber = match[1];
      let questionContent = match[2].trim();

      // Estimate which page this question is on
      const estimatedPage = Math.floor(qIndex / questionsPerPage);
      const pageImages = imagesByPage.get(estimatedPage) || [];

      if (!questionContent) {
        // Pure image question - use next available image
        if (globalImageIndex < allImagesFlattened.length) {
          questions.push({
            content: allImagesFlattened[globalImageIndex++],
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

      // Check for image markers
      const imageMarkerPattern = /(\[IMG\]|\(hình\)|\[ảnh\]|\[image\])/gi;
      const markers = questionText.match(imageMarkerPattern);
      const hasImageMarkers = markers && markers.length > 0;

      const contentParts: { content: string; contentType: ContentTypes }[] = [];

      if (hasImageMarkers) {
        // Parse with markers - more accurate
        const parts = questionText
          .split(imageMarkerPattern)
          .filter((p) => p && p.trim());

        for (const part of parts) {
          const trimmedPart = part.trim();

          if (/\[IMG\]|\(hình\)|\[ảnh\]|\[image\]/i.test(trimmedPart)) {
            // Use image from estimated page first, fallback to global
            if (
              pageImages.length > 0 &&
              globalImageIndex < allImagesFlattened.length
            ) {
              const pageImageIndex = globalImageIndex % pageImages.length;
              contentParts.push({
                content:
                  pageImages[pageImageIndex]?.path ||
                  allImagesFlattened[globalImageIndex],
                contentType: ContentTypes.IMAGE,
              });
            } else if (globalImageIndex < allImagesFlattened.length) {
              contentParts.push({
                content: allImagesFlattened[globalImageIndex],
                contentType: ContentTypes.IMAGE,
              });
            }
            globalImageIndex++;
          } else if (trimmedPart.length > 0) {
            contentParts.push({
              content: `Câu ${questionNumber}: ${trimmedPart}`,
              contentType: ContentTypes.TEXT,
            });
          }
        }
      } else {
        // No markers - pure text or very short (might be image)
        if (!questionText || questionText.length < 10) {
          if (globalImageIndex < allImagesFlattened.length) {
            contentParts.push({
              content: allImagesFlattened[globalImageIndex++],
              contentType: ContentTypes.IMAGE,
            });
          }
        } else {
          contentParts.push({
            content: `Câu ${questionNumber}: ${questionText}`,
            contentType: ContentTypes.TEXT,
          });
        }
      }

      // Fallback if no parts
      if (contentParts.length === 0) {
        contentParts.push({
          content: `Câu ${questionNumber}: ${questionText}`,
          contentType: ContentTypes.TEXT,
        });
      }

      // Parse answers with position-based image matching
      const answerPattern = /([A-D])[\.\)]\s*([^\n]+)/gi;
      const answerMatches = [...remainingText.matchAll(answerPattern)];

      const answers = answerMatches.map((m) => {
        const answerText = m[2].trim();

        // Check for markers in answer
        const answerMarkers = answerText.match(imageMarkerPattern);
        const hasAnswerMarkers = answerMarkers && answerMarkers.length > 0;

        if (hasAnswerMarkers) {
          const answerParts: {
            content: string;
            contentType: ContentTypes;
          }[] = [];
          const answerPartsSplit = answerText
            .split(imageMarkerPattern)
            .filter((p) => p && p.trim());

          for (const part of answerPartsSplit) {
            const trimmedPart = part.trim();

            if (/\[IMG\]|\(hình\)|\[ảnh\]|\[image\]/i.test(trimmedPart)) {
              if (globalImageIndex < allImagesFlattened.length) {
                answerParts.push({
                  content: allImagesFlattened[globalImageIndex++],
                  contentType: ContentTypes.IMAGE,
                });
              }
            } else if (trimmedPart.length > 0) {
              answerParts.push({
                content: trimmedPart,
                contentType: ContentTypes.TEXT,
              });
            }
          }

          if (answerParts.length > 0) {
            return {
              content: answerParts[0].content,
              contentType: answerParts[0].contentType,
              answerParts: answerParts.length > 1 ? answerParts : undefined,
            };
          }
        }

        // No markers - check if very short (likely image)
        if (
          answerText.length < 5 &&
          globalImageIndex < allImagesFlattened.length
        ) {
          return {
            content: allImagesFlattened[globalImageIndex++],
            contentType: ContentTypes.IMAGE,
          };
        }

        return {
          content: answerText,
          contentType: ContentTypes.TEXT,
        };
      });

      // Use first content part as main content
      const mainContent = contentParts[0];

      questions.push({
        content: mainContent.content,
        contentType: mainContent.contentType,
        answers,
        contentParts: contentParts.length > 1 ? contentParts : undefined,
      });
    }

    console.log(`Successfully parsed ${questions.length} questions`);
    return questions;
  }
}
