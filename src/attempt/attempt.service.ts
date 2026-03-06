import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AttemptEntity } from './attempt.entity';
import { StudentService } from 'src/student/student.service';
import { QuestionBankService } from 'src/question-bank/question-bank.service';
import {
  ENTITY_NAMES,
  ERROR_MESSAGES,
} from 'src/common/constant/error-messages.constant';
import { PaginationResponseDto } from 'src/common/dto/pagination.dto';
import { autoMapListToDto } from 'src/common/utils/auto-map.util';
import { AttemptResponseDto } from './dto/attempt.dto';
import { AttemptStatus } from './enum/attempt-status.enum';
import { CreateAttemptDto, UpdateAttemptDto } from './dto/create-attempt.dto';
import { ExamSetService } from 'src/exam-set/exam-set.service';
import { JwtPayload } from 'src/common/interface/jwt-payload.interface';
import { UserType } from 'src/common/enum/user-type.enum';
import { QuestionBankQuestionEntity } from 'src/question-bank-question/question-bank-question.entity';
import { QuestionEntity } from 'src/question/question.entity';
import { AnswerEntity } from 'src/answer/answer.entity';
import { StudentAnswerEntity } from 'src/student-answer/student-answer.entity';
import { ExamSetQuestionBankService } from 'src/exam-set-question-bank/exam-set-question-bank.service';
import {
  AttemptAnswerChainItemDto,
  AttemptAnswerOptionDto,
  AttemptQuestionChainItemDto,
  AttemptQuestionItemDto,
  EndAttemptAnswerDto,
  EndAttemptDto,
  EndAttemptResponseDto,
  StartAttemptDto,
  StartAttemptResponseDto,
} from './dto/attempt-session.dto';

@Injectable()
export class AttemptService {
  constructor(
    @InjectRepository(AttemptEntity)
    private readonly attemptRepo: Repository<AttemptEntity>,
    @InjectRepository(QuestionBankQuestionEntity)
    private readonly questionBankQuestionRepo: Repository<QuestionBankQuestionEntity>,
    @InjectRepository(QuestionEntity)
    private readonly questionRepo: Repository<QuestionEntity>,
    @InjectRepository(AnswerEntity)
    private readonly answerRepo: Repository<AnswerEntity>,
    @InjectRepository(StudentAnswerEntity)
    private readonly studentAnswerRepo: Repository<StudentAnswerEntity>,
    private readonly studentService: StudentService,
    private readonly questionBankService: QuestionBankService,
    private readonly examSetService: ExamSetService,
    private readonly examSetQuestionBankService: ExamSetQuestionBankService,
  ) {}

  async create(dto: CreateAttemptDto): Promise<AttemptEntity> {
    await this.studentService.findOne(dto.studentId);
    await this.questionBankService.findOne(dto.questionBankId);
    await this.examSetService.findOne(dto.examSetId);

    const record = this.attemptRepo.create({
      studentId: dto.studentId,
      questionBankId: dto.questionBankId,
      examSetId: dto.examSetId,
      status: dto.status ?? AttemptStatus.DOING,
      startedAt: new Date(dto.startedAt),
      submittedAt: dto.submittedAt ? new Date(dto.submittedAt) : undefined,
      score: dto.score,
    });

    return this.attemptRepo.save(record);
  }

  async start(
    dto: StartAttemptDto,
    user: JwtPayload,
  ): Promise<StartAttemptResponseDto> {
    if (!user?.userId) {
      throw new ForbiddenException(ERROR_MESSAGES.INVALID_TOKEN_STRUCTURE);
    }

    await this.questionBankService.findOne(dto.questionBankId);
    await this.examSetService.findOne(dto.examSetId);
    await this.validateExamSetQuestionBank(dto.examSetId, dto.questionBankId);

    const record = this.attemptRepo.create({
      studentId: user.userId,
      questionBankId: dto.questionBankId,
      examSetId: dto.examSetId,
      status: AttemptStatus.DOING,
      startedAt: new Date(),
    });

    const savedAttempt = await this.attemptRepo.save(record);
    const questions = await this.getExamQuestions(dto.questionBankId);

    return {
      attemptId: savedAttempt.id,
      status: savedAttempt.status,
      startedAt: savedAttempt.startedAt,
      studentId: savedAttempt.studentId,
      questionBankId: savedAttempt.questionBankId,
      examSetId: savedAttempt.examSetId,
      questions,
    };
  }

  async end(
    id: string,
    dto: EndAttemptDto,
    user: JwtPayload,
  ): Promise<EndAttemptResponseDto> {
    if (!user?.userId) {
      throw new ForbiddenException(ERROR_MESSAGES.INVALID_TOKEN_STRUCTURE);
    }

    const attempt = await this.attemptRepo.findOne({
      where: { id, studentId: user.userId, status: AttemptStatus.DOING },
      relations: ['student', 'questionBank', 'examSet'],
    });

    if (!attempt) {
      throw new ForbiddenException(ERROR_MESSAGES.NO_PERMISSION_SUBMIT_ATTEMPT);
    }

    const questionLinks = await this.questionBankQuestionRepo.find({
      where: { questionBankId: attempt.questionBankId },
      order: { orderNo: 'ASC' },
    });
    const submittedAnswers = await this.normalizeSubmittedAnswers(
      dto.answers,
      questionLinks,
    );
    const allowedQuestionIds = new Set(
      questionLinks.map((item) => item.questionId),
    );

    if (
      submittedAnswers.some((item) => !allowedQuestionIds.has(item.questionId))
    ) {
      throw new BadRequestException(
        ERROR_MESSAGES.ATTEMPT_INVALID_QUESTION_IN_SUBMISSION,
      );
    }

    await this.studentAnswerRepo.delete({ attemptId: attempt.id });

    if (dto.answers.length > 0) {
      const allAnswerIds = [
        ...new Set(
          submittedAnswers
            .flatMap((item) => [
              item.answerId,
              ...(item.selectedAnswerIds ?? []),
            ])
            .filter((item): item is string => Boolean(item)),
        ),
      ];

      const answerEntities = allAnswerIds.length
        ? await this.answerRepo.find({ where: { id: In(allAnswerIds) } })
        : [];
      const answerMap = new Map(answerEntities.map((item) => [item.id, item]));

      for (const submitted of submittedAnswers) {
        if (submitted.answerId) {
          const answer = answerMap.get(submitted.answerId);
          if (!answer || answer.questionId !== submitted.questionId) {
            throw new BadRequestException(
              ERROR_MESSAGES.ATTEMPT_INVALID_ANSWER_MAPPING,
            );
          }
        }

        for (const selectedId of submitted.selectedAnswerIds ?? []) {
          const answer = answerMap.get(selectedId);
          if (!answer || answer.questionId !== submitted.questionId) {
            throw new BadRequestException(
              ERROR_MESSAGES.ATTEMPT_INVALID_SELECTED_ANSWER_MAPPING,
            );
          }
        }
      }

      const records = submittedAnswers.map((submitted) =>
        this.studentAnswerRepo.create({
          attemptId: attempt.id,
          questionId: submitted.questionId,
          answerId: submitted.answerId,
          description: submitted.description,
          textValue: submitted.textValue,
          selectedAnswerIds: submitted.selectedAnswerIds,
          timeSpentSec: submitted.timeSpentSec,
        }),
      );
      await this.studentAnswerRepo.save(records);
    }

    attempt.status = AttemptStatus.SUBMITTED;
    attempt.submittedAt = new Date();
    attempt.score = null as unknown as number;
    const savedAttempt = await this.attemptRepo.save(attempt);

    return {
      attemptId: savedAttempt.id,
      status: savedAttempt.status,
      submittedAt: savedAttempt.submittedAt!,
      score: savedAttempt.score ?? null,
      totalQuestions: questionLinks.length,
      answeredQuestions: submittedAnswers.length,
    };
  }

  async findAll(
    user: JwtPayload,
    page = 1,
    size = 10,
    questionBankId?: string,
    examSetId?: string,
    status?: AttemptStatus,
  ): Promise<PaginationResponseDto<AttemptResponseDto>> {
    const skip = (page - 1) * size;

    if (!user?.userId) {
      throw new ForbiddenException(ERROR_MESSAGES.INVALID_TOKEN_STRUCTURE);
    }

    const qb = this.attemptRepo
      .createQueryBuilder('attempt')
      .leftJoinAndSelect('attempt.student', 'student')
      .leftJoinAndSelect('attempt.questionBank', 'questionBank')
      .leftJoinAndSelect('attempt.examSet', 'examSet');

    qb.andWhere('student.user_id = :userId', {
      userId: user.userId,
    });

    if (questionBankId) {
      qb.andWhere('attempt.question_bank_id = :questionBankId', {
        questionBankId,
      });
    }

    if (examSetId) {
      qb.andWhere('attempt.exam_set_id = :examSetId', { examSetId });
    }

    if (status) {
      qb.andWhere('attempt.status = :status', { status });
    }

    qb.orderBy('attempt.started_at', 'DESC');
    qb.skip(skip).take(size);

    const [data, total] = await qb.getManyAndCount();

    return {
      data: autoMapListToDto(AttemptResponseDto, data),
      page,
      size,
      total,
    };
  }

  async findOne(id: string): Promise<AttemptEntity> {
    const record = await this.attemptRepo.findOne({
      where: { id },
      relations: ['student', 'questionBank', 'examSet'],
    });

    if (!record) {
      throw new NotFoundException(
        ERROR_MESSAGES.NOT_FOUND_WITH_ID(ENTITY_NAMES.ATTEMPT ?? 'Bai lam', id),
      );
    }

    return record;
  }

  async update(id: string, dto: UpdateAttemptDto): Promise<AttemptEntity> {
    const record = await this.findOne(id);

    if (dto.studentId !== undefined) {
      await this.studentService.findOne(dto.studentId);
      record.studentId = dto.studentId;
    }

    if (dto.questionBankId !== undefined) {
      await this.questionBankService.findOne(dto.questionBankId);
      record.questionBankId = dto.questionBankId;
    }

    if (dto.examSetId !== undefined) {
      await this.examSetService.findOne(dto.examSetId);
      record.examSetId = dto.examSetId;
    }

    if (dto.status !== undefined) {
      record.status = dto.status;
    }

    if (dto.startedAt !== undefined) {
      record.startedAt = new Date(dto.startedAt);
    }

    if (dto.submittedAt !== undefined) {
      record.submittedAt = dto.submittedAt
        ? new Date(dto.submittedAt)
        : undefined;
    }

    if (dto.score !== undefined) {
      record.score = dto.score;
    }

    return this.attemptRepo.save(record);
  }

  async remove(id: string): Promise<void> {
    const record = await this.findOne(id);
    await this.attemptRepo.remove(record);
  }

  private async validateExamSetQuestionBank(
    examSetId: string,
    questionBankId: string,
  ): Promise<void> {
    await this.examSetQuestionBankService.validateExamSetQuestionBank(
      examSetId,
      questionBankId,
    );
  }

  private async getExamQuestions(
    questionBankId: string,
  ): Promise<AttemptQuestionItemDto[]> {
    const links = await this.questionBankQuestionRepo.find({
      where: { questionBankId },
      order: { orderNo: 'ASC' },
    });

    const rootQuestionIds = links.map((item) => item.questionId);
    const rootQuestions = rootQuestionIds.length
      ? await this.questionRepo.find({ where: { id: In(rootQuestionIds) } })
      : [];
    const questionMap = new Map(rootQuestions.map((item) => [item.id, item]));

    const allAnswers = rootQuestionIds.length
      ? await this.answerRepo.find({
          where: { questionId: In(rootQuestionIds) },
          order: { createdAt: 'ASC' },
        })
      : [];
    const answersByQuestionId = new Map<string, AnswerEntity[]>();

    for (const answer of allAnswers) {
      const items = answersByQuestionId.get(answer.questionId) ?? [];
      items.push(answer);
      answersByQuestionId.set(answer.questionId, items);
    }

    const result: AttemptQuestionItemDto[] = [];

    for (const link of links) {
      const rootQuestion = questionMap.get(link.questionId);
      if (!rootQuestion) {
        continue;
      }

      const questionChain = await this.loadQuestionChain(rootQuestion.id);
      const answerOptions = answersByQuestionId.get(rootQuestion.id) ?? [];
      const mappedAnswers = await Promise.all(
        answerOptions.map(async (answer) => {
          const chain = await this.loadAnswerChain(answer.id);
          return this.mapAnswerChain(chain);
        }),
      );

      result.push({
        id: rootQuestion.id,
        orderNo: link.orderNo,
        points: link.points,
        contentType: rootQuestion.contentType,
        content: rootQuestion.content,
        nextContent: rootQuestion.nextContent ?? null,
        chain: this.mapQuestionChain(questionChain),
        answers: mappedAnswers,
      });
    }

    return result;
  }

  private async loadQuestionChain(id: string): Promise<QuestionEntity[]> {
    const chain: QuestionEntity[] = [];
    let currentId: string | undefined = id;
    let depth = 0;

    while (currentId && depth < 10) {
      const item = await this.questionRepo.findOne({
        where: { id: currentId },
      });
      if (!item) {
        break;
      }
      chain.push(item);
      currentId = item.nextContent;
      depth++;
    }

    return chain;
  }

  private async loadAnswerChain(id: string): Promise<AnswerEntity[]> {
    const chain: AnswerEntity[] = [];
    let currentId: string | undefined = id;
    let depth = 0;

    while (currentId && depth < 10) {
      const item = await this.answerRepo.findOne({ where: { id: currentId } });
      if (!item) {
        break;
      }
      chain.push(item);
      currentId = item.nextContent;
      depth++;
    }

    return chain;
  }

  private async normalizeSubmittedAnswers(
    answers: Array<EndAttemptAnswerDto | string>,
    questionLinks: QuestionBankQuestionEntity[],
  ): Promise<EndAttemptAnswerDto[]> {
    if (answers.length === 0) {
      return [];
    }

    if (typeof answers[0] !== 'string') {
      return answers as EndAttemptAnswerDto[];
    }

    const questionOrderMap = new Map(
      questionLinks.map((item) => [item.orderNo, item.questionId]),
    );
    const questionIds = questionLinks.map((item) => item.questionId);
    const answerOptions = questionIds.length
      ? await this.answerRepo.find({
          where: { questionId: In(questionIds) },
          order: { createdAt: 'ASC' },
        })
      : [];
    const answersByQuestionId = new Map<string, AnswerEntity[]>();

    for (const answer of answerOptions) {
      const items = answersByQuestionId.get(answer.questionId) ?? [];
      items.push(answer);
      answersByQuestionId.set(answer.questionId, items);
    }

    return answers.map((item) => {
      if (typeof item !== 'string') {
        return item;
      }

      const trimmed = item.trim().toUpperCase();
      const matched = trimmed.match(/^(\d+)([A-Z]+)$/);
      if (!matched) {
        throw new BadRequestException(ERROR_MESSAGES.INVALID_INPUT);
      }

      const orderNo = Number(matched[1]);
      const choiceCodes = [...new Set(matched[2].split(''))];
      const questionId = questionOrderMap.get(orderNo);

      if (!questionId) {
        throw new BadRequestException(ERROR_MESSAGES.INVALID_INPUT);
      }

      const questionAnswers = answersByQuestionId.get(questionId) ?? [];
      const selectedAnswerIds = choiceCodes.map((choiceCode) => {
        const index = choiceCode.charCodeAt(0) - 65;
        const answer = questionAnswers[index];
        if (!answer) {
          throw new BadRequestException(ERROR_MESSAGES.INVALID_INPUT);
        }
        return answer.id;
      });

      return {
        questionId,
        answerId: selectedAnswerIds.length === 1 ? selectedAnswerIds[0] : undefined,
        selectedAnswerIds:
          selectedAnswerIds.length > 1 ? selectedAnswerIds : undefined,
      };
    });
  }

  private mapQuestionChain(
    chain: QuestionEntity[],
  ): AttemptQuestionChainItemDto[] {
    return chain.map((item) => ({
      id: item.id,
      contentType: item.contentType,
      content: item.content,
      nextContent: item.nextContent ?? null,
    }));
  }

  private mapAnswerChain(chain: AnswerEntity[]): AttemptAnswerOptionDto {
    const root = chain[0];
    const mappedChain: AttemptAnswerChainItemDto[] = chain.map((item) => ({
      id: item.id,
      contentType: item.contentType,
      content: item.content,
      nextContent: item.nextContent ?? null,
    }));

    return {
      id: root.id,
      contentType: root.contentType,
      content: root.content,
      nextContent: root.nextContent ?? null,
      chain: mappedChain,
    };
  }
}
