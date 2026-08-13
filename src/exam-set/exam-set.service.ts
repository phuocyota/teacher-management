import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ExamSetEntity } from './exam-set.entity';
import { CreateExamSetDto, UpdateExamSetDto } from './dto/create-exam-set.dto';
import {
  ERROR_MESSAGES,
  ENTITY_NAMES,
} from 'src/common/constant/error-messages.constant';
import { PaginationResponseDto } from 'src/common/dto/pagination.dto';
import {
  ExamSetClassOptionDto,
  ExamSetDetailClassDto,
  ExamSetDetailResponseDto,
  ExamSetOptionDto,
  ExamSetOptionsResponseDto,
  ExamSetResponseDto,
} from './dto/exam-set.dto';
import { ExamSetStatus } from './enum/exam-set-status.enum';
import { ClassService } from 'src/class/class.service';
import { ExamSetQuestionBankEntity } from 'src/exam-set-question-bank/exam-set-question-bank.entity';
import { QuestionBankQuestionEntity } from 'src/question-bank-question/question-bank-question.entity';
import { JwtPayload } from 'src/common/interface/jwt-payload.interface';
import { ExamSetClassEntity } from 'src/exam-set-class/exam-set-class.entity';
import { ClassEntity } from 'src/class/class.entity';
import { QuestionBankSectionEntity } from 'src/question-bank-section/question-bank-section.entity';

@Injectable()
export class ExamSetService {
  constructor(
    @InjectRepository(ExamSetEntity)
    private readonly examSetRepo: Repository<ExamSetEntity>,
    @InjectRepository(ExamSetQuestionBankEntity)
    private readonly examSetQuestionBankRepo: Repository<ExamSetQuestionBankEntity>,
    @InjectRepository(QuestionBankQuestionEntity)
    private readonly questionBankQuestionRepo: Repository<QuestionBankQuestionEntity>,
    @InjectRepository(QuestionBankSectionEntity)
    private readonly questionBankSectionRepo: Repository<QuestionBankSectionEntity>,
    @InjectRepository(ExamSetClassEntity)
    private readonly examSetClassRepo: Repository<ExamSetClassEntity>,
    private readonly classService: ClassService,
  ) {}

  async create(dto: CreateExamSetDto): Promise<ExamSetResponseDto> {
    const classIds = await this.resolveValidatedClassIds(dto);
    const record = this.examSetRepo.create({
      name: dto.name,
      description: dto.description,
      image: dto.image,
      status: dto.status ?? ExamSetStatus.DRAFT,
      classId: classIds[0],
    });

    const savedRecord = await this.examSetRepo.save(record);
    await this.replaceExamSetClasses(savedRecord.id, classIds);

    return this.mapExamSetToResponse(savedRecord, classIds);
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
      .leftJoin(ExamSetClassEntity, 'esc', 'esc.examSetId = es.id')
      .leftJoin(ClassEntity, 'linkedClass', 'linkedClass.id = esc.classId')
      .leftJoin('es.class', 'legacyClass')
      .distinct(true);

    if (classId) {
      qb.andWhere('(esc.classId = :classId OR es.classId = :classId)', {
        classId,
      });
    }

    if (gradeId) {
      qb.andWhere(
        '(linkedClass.gradeId = :gradeId OR legacyClass.gradeId = :gradeId)',
        { gradeId },
      );
    }

    if (subjectId) {
      qb.andWhere(
        '(linkedClass.subjectId = :subjectId OR legacyClass.subjectId = :subjectId)',
        { subjectId },
      );
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
    const classIdsMap = await this.getClassIdsByExamSetIds(data);

    return {
      data: data.map((item) =>
        this.mapExamSetToResponse(item, classIdsMap.get(item.id) ?? []),
      ),
      page,
      size,
      total,
    };
  }

  async getOptions(user?: JwtPayload): Promise<ExamSetOptionsResponseDto> {
    const classes = await this.classService.findAll(user);
    const classOptions: ExamSetClassOptionDto[] = classes.map((item) => ({
      value: item.id,
      label: item.name,
      code: item.code,
      name: item.name,
    }));

    const classIds = classOptions.map((item) => item.value);
    if (classIds.length === 0) {
      return {
        classes: classOptions,
        examSets: [],
      };
    }

    const examSets = await this.examSetRepo
      .createQueryBuilder('es')
      .leftJoin(ExamSetClassEntity, 'esc', 'esc.examSetId = es.id')
      .where('esc.classId IN (:...classIds) OR es.classId IN (:...classIds)', {
        classIds,
      })
      .orderBy('es.name', 'ASC')
      .distinct(true)
      .getMany();

    const classIdsMap = await this.getClassIdsByExamSetIds(examSets);
    const examSetOptions: ExamSetOptionDto[] = examSets.map((item) => {
      const examSetClassIds = classIdsMap.get(item.id) ?? [];
      return {
        value: item.id,
        label: item.name,
        name: item.name,
        classId: examSetClassIds[0],
        classIds: examSetClassIds,
        status: item.status,
      };
    });

    return {
      classes: classOptions,
      examSets: examSetOptions,
    };
  }

  async findOne(id: string): Promise<ExamSetDetailResponseDto> {
    const record = await this.findOneEntity(id);
    const classLinks = await this.getClassLinks(id, record.classId);
    const classIds = classLinks.map((item) => item.id);

    const links = await this.examSetQuestionBankRepo.find({
      where: { examSetId: id },
      relations: ['questionBank'],
      order: { order: 'ASC' },
    });
    const questionBankIds = links
      .map((item) => item.questionBank?.id)
      .filter((questionBankId): questionBankId is string =>
        Boolean(questionBankId),
      );
    const questionCounts =
      questionBankIds.length > 0
        ? await this.getQuestionCountsByBankIds(questionBankIds)
        : new Map<string, number>();
    const sectionCounts =
      questionBankIds.length > 0
        ? await this.getSectionCountsByBankIds(questionBankIds)
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
          sectionCount: sectionCounts.get(qb.id) ?? 0,
          maxAttempts: qb.maxAttempts ?? null,
          totalPoints: qb.totalMarks ?? null,
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
      classId: classIds[0],
      classIds,
      status: record.status,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      createdBy: record.createdBy ?? '',
      updatedBy: record.updatedBy ?? '',
      subjectId: this.getSharedValue(classLinks, 'subjectId'),
      gradeId: this.getSharedValue(classLinks, 'gradeId'),
      classes: classLinks.map((item) => ({
        id: item.id,
        code: item.code,
        name: item.name,
      })),
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

  async update(id: string, dto: UpdateExamSetDto): Promise<ExamSetResponseDto> {
    const record = await this.findOneEntity(id);
    const currentClassIds = await this.getClassIdsByExamSetIds([record]);

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

    let classIds = currentClassIds.get(record.id) ?? [];
    if (dto.classIds !== undefined || dto.classId !== undefined) {
      classIds = await this.resolveValidatedClassIds(dto);
      record.classId = classIds[0];
    }

    const savedRecord = await this.examSetRepo.save(record);

    if (dto.classIds !== undefined || dto.classId !== undefined) {
      await this.replaceExamSetClasses(savedRecord.id, classIds);
    }

    return this.mapExamSetToResponse(savedRecord, classIds);
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

  private async getSectionCountsByBankIds(
    questionBankIds: string[],
  ): Promise<Map<string, number>> {
    const rows = await this.questionBankSectionRepo
      .createQueryBuilder('section')
      .select('section.questionBankId', 'questionBankId')
      .addSelect('COUNT(*)', 'sectionCount')
      .where('section.questionBankId IN (:...questionBankIds)', {
        questionBankIds,
      })
      .groupBy('section.questionBankId')
      .getRawMany<{ questionBankId: string; sectionCount: string }>();

    return new Map(
      rows.map((row) => [
        row.questionBankId,
        Number.parseInt(row.sectionCount, 10) || 0,
      ]),
    );
  }

  private async resolveValidatedClassIds(
    dto: Pick<CreateExamSetDto, 'classId' | 'classIds'>,
  ): Promise<string[]> {
    const normalizedClassIds = Array.from(
      new Set([...(dto.classIds ?? []), ...(dto.classId ? [dto.classId] : [])]),
    );

    await Promise.all(
      normalizedClassIds.map((classId) => this.classService.findOne(classId)),
    );

    return normalizedClassIds;
  }

  private async replaceExamSetClasses(
    examSetId: string,
    classIds: string[],
  ): Promise<void> {
    await this.examSetClassRepo.delete({ examSetId });

    if (classIds.length === 0) {
      return;
    }

    const entities = classIds.map((classId) =>
      this.examSetClassRepo.create({
        examSetId,
        classId,
      }),
    );

    await this.examSetClassRepo.save(entities);
  }

  private async getClassIdsByExamSetIds(
    examSets: ExamSetEntity[],
  ): Promise<Map<string, string[]>> {
    const examSetIds = examSets.map((item) => item.id);
    const classIdMap = new Map<string, string[]>();

    if (examSetIds.length === 0) {
      return classIdMap;
    }

    const links = await this.examSetClassRepo.find({
      where: { examSetId: In(examSetIds) },
      order: { createdAt: 'ASC' },
    });

    for (const examSet of examSets) {
      classIdMap.set(
        examSet.id,
        examSet.classId ? [examSet.classId] : [],
      );
    }

    for (const link of links) {
      const current = classIdMap.get(link.examSetId) ?? [];
      if (!current.includes(link.classId)) {
        current.push(link.classId);
      }
      classIdMap.set(link.examSetId, current);
    }

    return classIdMap;
  }

  private async getClassLinks(
    examSetId: string,
    legacyClassId?: string,
  ): Promise<ClassEntity[]> {
    const links = await this.examSetClassRepo.find({
      where: { examSetId },
      relations: ['class'],
      order: { createdAt: 'ASC' },
    });

    const classMap = new Map<string, ClassEntity>();
    for (const link of links) {
      if (link.class) {
        classMap.set(link.class.id, link.class);
      }
    }

    if (classMap.size === 0 && legacyClassId) {
      const legacyClass = await this.classService.findOne(legacyClassId);
      classMap.set(legacyClass.id, legacyClass as ClassEntity);
    }

    return [...classMap.values()];
  }

  private getSharedValue(
    classes: ClassEntity[],
    key: 'gradeId' | 'subjectId',
  ): string | null {
    const values = Array.from(
      new Set(
        classes
          .map((item) => item[key] ?? null)
          .filter((value): value is string => Boolean(value)),
      ),
    );

    return values.length === 1 ? values[0] : null;
  }

  private mapExamSetToResponse(
    examSet: ExamSetEntity,
    classIds: string[],
  ): ExamSetResponseDto {
    return {
      id: examSet.id,
      name: examSet.name,
      description: examSet.description,
      image: examSet.image,
      classId: classIds[0],
      classIds,
      status: examSet.status,
      createdAt: examSet.createdAt,
      updatedAt: examSet.updatedAt,
      createdBy: examSet.createdBy ?? '',
      updatedBy: examSet.updatedBy ?? '',
    };
  }
}
