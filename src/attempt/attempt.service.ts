import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

@Injectable()
export class AttemptService {
  constructor(
    @InjectRepository(AttemptEntity)
    private readonly attemptRepo: Repository<AttemptEntity>,
    private readonly studentService: StudentService,
    private readonly questionBankService: QuestionBankService,
  ) {}

  async create(dto: CreateAttemptDto): Promise<AttemptEntity> {
    await this.studentService.findOne(dto.studentId);
    await this.questionBankService.findOne(dto.questionBankId);

    const record = this.attemptRepo.create({
      studentId: dto.studentId,
      questionBankId: dto.questionBankId,
      status: dto.status ?? AttemptStatus.DOING,
      startedAt: new Date(dto.startedAt),
      submittedAt: dto.submittedAt ? new Date(dto.submittedAt) : undefined,
      score: dto.score,
    });

    return this.attemptRepo.save(record);
  }

  async findAll(
    page = 1,
    size = 10,
    studentId?: string,
    questionBankId?: string,
    status?: AttemptStatus,
  ): Promise<PaginationResponseDto<AttemptResponseDto>> {
    const skip = (page - 1) * size;

    const qb = this.attemptRepo
      .createQueryBuilder('attempt')
      .leftJoinAndSelect('attempt.student', 'student')
      .leftJoinAndSelect('attempt.questionBank', 'questionBank');

    if (studentId) {
      qb.andWhere('attempt.student_id = :studentId', { studentId });
    }

    if (questionBankId) {
      qb.andWhere('attempt.question_bank_id = :questionBankId', {
        questionBankId,
      });
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
      relations: ['student', 'questionBank'],
    });

    if (!record) {
      throw new NotFoundException(
        ERROR_MESSAGES.NOT_FOUND_WITH_ID(ENTITY_NAMES.ATTEMPT ?? 'Bài làm', id),
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
}
