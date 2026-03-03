import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StudentAnswerEntity } from './student-answer.entity';
import { AttemptService } from 'src/attempt/attempt.service';
import { QuestionService } from 'src/question/question.service';
import { AnswerService } from 'src/answer/answer.service';
import {
  ENTITY_NAMES,
  ERROR_MESSAGES,
} from 'src/common/constant/error-messages.constant';
import { PaginationResponseDto } from 'src/common/dto/pagination.dto';
import { autoMapListToDto } from 'src/common/utils/auto-map.util';
import {
  CreateStudentAnswerDto,
  UpdateStudentAnswerDto,
} from './dto/create-student-answer.dto';
import { StudentAnswerResponseDto } from './dto/student-answer.dto';

@Injectable()
export class StudentAnswerService {
  constructor(
    @InjectRepository(StudentAnswerEntity)
    private readonly studentAnswerRepo: Repository<StudentAnswerEntity>,
    private readonly attemptService: AttemptService,
    private readonly questionService: QuestionService,
    private readonly answerService: AnswerService,
  ) {}

  async create(dto: CreateStudentAnswerDto): Promise<StudentAnswerEntity> {
    await this.attemptService.findOne(dto.attemptId);
    await this.questionService.findOne(dto.questionId);

    if (dto.answerId) {
      await this.answerService.findOne(dto.answerId);
    }

    const record = this.studentAnswerRepo.create(dto);
    return this.studentAnswerRepo.save(record);
  }

  async findAll(
    page = 1,
    size = 10,
    attemptId?: string,
    questionId?: string,
    answerId?: string,
  ): Promise<PaginationResponseDto<StudentAnswerResponseDto>> {
    const skip = (page - 1) * size;

    const qb = this.studentAnswerRepo
      .createQueryBuilder('studentAnswer')
      .leftJoinAndSelect('studentAnswer.attempt', 'attempt')
      .leftJoinAndSelect('studentAnswer.question', 'question')
      .leftJoinAndSelect('studentAnswer.answer', 'answer');

    if (attemptId) {
      qb.andWhere('studentAnswer.attempt_id = :attemptId', { attemptId });
    }

    if (questionId) {
      qb.andWhere('studentAnswer.question_id = :questionId', { questionId });
    }

    if (answerId) {
      qb.andWhere('studentAnswer.answer_id = :answerId', { answerId });
    }

    qb.orderBy('studentAnswer.createdAt', 'DESC');
    qb.skip(skip).take(size);

    const [data, total] = await qb.getManyAndCount();

    return {
      data: autoMapListToDto(StudentAnswerResponseDto, data),
      page,
      size,
      total,
    };
  }

  async findOne(id: string): Promise<StudentAnswerEntity> {
    const record = await this.studentAnswerRepo.findOne({
      where: { id },
      relations: ['attempt', 'question', 'answer'],
    });

    if (!record) {
      throw new NotFoundException(
        ERROR_MESSAGES.NOT_FOUND_WITH_ID(
          ENTITY_NAMES.STUDENT_ANSWER ?? 'Câu trả lời học sinh',
          id,
        ),
      );
    }

    return record;
  }

  async update(
    id: string,
    dto: UpdateStudentAnswerDto,
  ): Promise<StudentAnswerEntity> {
    const record = await this.findOne(id);

    if (dto.attemptId !== undefined) {
      await this.attemptService.findOne(dto.attemptId);
      record.attemptId = dto.attemptId;
    }

    if (dto.questionId !== undefined) {
      await this.questionService.findOne(dto.questionId);
      record.questionId = dto.questionId;
    }

    if (dto.answerId !== undefined) {
      if (dto.answerId) {
        await this.answerService.findOne(dto.answerId);
        record.answerId = dto.answerId;
      } else {
        record.answerId = undefined;
        record.answer = undefined;
      }
    }

    if (dto.description !== undefined) {
      record.description = dto.description;
    }

    if (dto.textValue !== undefined) {
      record.textValue = dto.textValue;
    }

    if (dto.isCorrect !== undefined) {
      record.isCorrect = dto.isCorrect;
    }

    if (dto.pointsEarned !== undefined) {
      record.pointsEarned = dto.pointsEarned;
    }

    if (dto.selectedAnswerIds !== undefined) {
      record.selectedAnswerIds = dto.selectedAnswerIds;
    }

    if (dto.timeSpentSec !== undefined) {
      record.timeSpentSec = dto.timeSpentSec;
    }

    return this.studentAnswerRepo.save(record);
  }

  async remove(id: string): Promise<void> {
    const record = await this.findOne(id);
    await this.studentAnswerRepo.remove(record);
  }
}
