import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExamSetEntity } from './exam-set.entity';
import { CreateExamSetDto, UpdateExamSetDto } from './dto/create-exam-set.dto';
import {
  ERROR_MESSAGES,
  ENTITY_NAMES,
} from 'src/common/constant/error-messages.constant';
import { PaginationResponseDto } from 'src/common/dto/pagination.dto';
import { ExamSetDetailResponseDto, ExamSetResponseDto } from './dto/exam-set.dto';
import { autoMapListToDto } from 'src/common/utils/auto-map.util';
import { ExamSetStatus } from './enum/exam-set-status.enum';
import { ClassService } from 'src/class/class.service';
import { ExamSetQuestionBankEntity } from 'src/exam-set-question-bank/exam-set-question-bank.entity';
import { QuestionBankQuestionEntity } from 'src/question-bank-question/question-bank-question.entity';

@Injectable()
export class ExamSetService {
  constructor(
    @InjectRepository(ExamSetEntity)
    private readonly examSetRepo: Repository<ExamSetEntity>,
    @InjectRepository(ExamSetQuestionBankEntity)
    private readonly examSetQuestionBankRepo: Repository<ExamSetQuestionBankEntity>,
    @InjectRepository(QuestionBankQuestionEntity)
    private readonly questionBankQuestionRepo: Repository<QuestionBankQuestionEntity>,
    private readonly classService: ClassService,
  ) {}

  async create(dto: CreateExamSetDto): Promise<ExamSetEntity> {
    const record = this.examSetRepo.create({
      name: dto.name,
      description: dto.description,
      image: dto.image,
      status: dto.status ?? ExamSetStatus.DRAFT,
    });

    if (dto.classId) {
      const cls = await this.classService.findOne(dto.classId);
      record.class = cls;
      record.classId = cls.id;
    }

    return this.examSetRepo.save(record);
  }

  async findAll(
    page = 1,
    size = 10,
    classId?: string,
    gradeId?: string,
    subjectId?: string,
    status?: ExamSetStatus,
    search?: string,
  ): Promise<PaginationResponseDto<ExamSetResponseDto>> {
    const skip = (page - 1) * size;

    const qb = this.examSetRepo
      .createQueryBuilder('es')
      .leftJoin('es.class', 'class');

    if (classId) {
      qb.andWhere('es.class_id = :classId', { classId });
    }

    if (gradeId) {
      qb.andWhere('class.grade_id = :gradeId', { gradeId });
    }

    if (subjectId) {
      qb.andWhere('class.subject_id = :subjectId', { subjectId });
    }

    if (status) {
      qb.andWhere('es.status = :status', { status });
    }

    if (search) {
      qb.andWhere('(es.name ILIKE :search OR es.description ILIKE :search)', {
        search: `%${search}%`,
      });
    }

    qb.orderBy('es.createdAt', 'DESC');
    qb.skip(skip).take(size);

    const [data, total] = await qb.getManyAndCount();

    return {
      data: autoMapListToDto(ExamSetResponseDto, data),
      page,
      size,
      total,
    };
  }

  async findOne(id: string): Promise<ExamSetDetailResponseDto> {
    const record = await this.findOneEntity(id);

    const links = await this.examSetQuestionBankRepo.find({
      where: { examSetId: id },
      relations: ['questionBank'],
      order: { order: 'ASC' },
    });
    const questionBankIds = links
      .map((item) => item.questionBank?.id)
      .filter((questionBankId): questionBankId is string => Boolean(questionBankId));
    const questionCounts =
      questionBankIds.length > 0
        ? await this.getQuestionCountsByBankIds(questionBankIds)
        : new Map<string, number>();

    const questionBanks = links
      .filter((item) => Boolean(item.questionBank))
      .map((item) => {
        const qb = item.questionBank;
        return {
          id: qb.id,
          title: qb.name,
          durationSeconds:
            qb.timeLimit !== null && qb.timeLimit !== undefined
              ? qb.timeLimit * 60
              : null,
          totalQuestions:
            qb.totalQuestions ?? questionCounts.get(qb.id) ?? null,
          maxAttempts: qb.maxAttempts ?? null,
          totalPoints: qb.totalMarks ?? qb.totalScore ?? null,
          difficulty: null,
          status: null,
          createdAt: qb.createdAt,
        };
      });

    return {
      id: record.id,
      name: record.name,
      description: record.description,
      image: record.image,
      classId: record.classId,
      status: record.status,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      createdBy: record.createdBy ?? '',
      updatedBy: record.updatedBy ?? '',
      subjectId: record.class?.subjectId ?? null,
      gradeId: record.class?.gradeId ?? null,
      questionBanks,
      stats: {
        questionBankCount: questionBanks.length,
      },
    };
  }

  private async findOneEntity(id: string): Promise<ExamSetEntity> {
    const record = await this.examSetRepo.findOne({
      where: { id },
      relations: ['class'],
    });

    if (!record) {
      throw new NotFoundException(
        ERROR_MESSAGES.NOT_FOUND_WITH_ID(
          ENTITY_NAMES.EXAM_SET ?? 'Bo de thi',
          id,
        ),
      );
    }

    return record;
  }

  async update(id: string, dto: UpdateExamSetDto): Promise<ExamSetEntity> {
    const record = await this.findOneEntity(id);

    if (dto.classId !== undefined) {
      if (dto.classId) {
        const cls = await this.classService.findOne(dto.classId);
        record.class = cls;
        record.classId = cls.id;
      } else {
        record.class = undefined;
        record.classId = undefined;
      }
    }

    if (dto.name !== undefined) {
      record.name = dto.name;
    }

    if (dto.description !== undefined) {
      record.description = dto.description;
    }

    if (dto.image !== undefined) {
      record.image = dto.image;
    }

    if (dto.status !== undefined) {
      record.status = dto.status;
    }

    return this.examSetRepo.save(record);
  }

  async remove(id: string): Promise<void> {
    const record = await this.findOneEntity(id);
    await this.examSetRepo.remove(record);
  }

  private async getQuestionCountsByBankIds(
    questionBankIds: string[],
  ): Promise<Map<string, number>> {
    const rows = await this.questionBankQuestionRepo
      .createQueryBuilder('qbq')
      .select('qbq.questionBankId', 'questionBankId')
      .addSelect('COUNT(*)', 'totalQuestions')
      .where('qbq.questionBankId IN (:...questionBankIds)', { questionBankIds })
      .groupBy('qbq.questionBankId')
      .getRawMany<{ questionBankId: string; totalQuestions: string }>();

    return new Map(
      rows.map((row) => [
        row.questionBankId,
        Number.parseInt(row.totalQuestions, 10) || 0,
      ]),
    );
  }
}
