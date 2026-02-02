import {
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnswerEntity } from './answer.entity';
import { CreateAnswerDto, UpdateAnswerDto } from './dto/create-answer.dto';
import { QuestionService } from 'src/question/question.service';
import {
  ERROR_MESSAGES,
  ENTITY_NAMES,
} from 'src/common/constant/error-messages.constant';
import { PaginationResponseDto } from 'src/common/dto/pagination.dto';
import { AnswerResponseDto } from './dto/answer.dto';
import { autoMapListToDto } from 'src/common/utils/auto-map.util';

@Injectable()
export class AnswerService {
  constructor(
    @InjectRepository(AnswerEntity)
    private readonly answerRepo: Repository<AnswerEntity>,
    @Inject(forwardRef(() => QuestionService))
    private readonly questionService: QuestionService,
  ) {}

  async create(dto: CreateAnswerDto): Promise<AnswerEntity> {
    // Validate questionId exists
    await this.questionService.findOne(dto.questionId);

    const record = this.answerRepo.create(dto);
    return this.answerRepo.save(record);
  }

  async findAll(
    page = 1,
    size = 10,
    questionId?: string,
    answerType?: string,
  ): Promise<PaginationResponseDto<AnswerResponseDto>> {
    const skip = (page - 1) * size;

    const qb = this.answerRepo
      .createQueryBuilder('answer')
      .leftJoinAndSelect('answer.question', 'question');

    if (questionId) {
      qb.andWhere('answer.questionId = :questionId', { questionId });
    }

    if (answerType) {
      qb.andWhere('answer.answerType = :answerType', { answerType });
    }

    qb.orderBy('answer.createdAt', 'DESC');
    qb.skip(skip).take(size);

    const [data, total] = await qb.getManyAndCount();

    return {
      data: autoMapListToDto(AnswerResponseDto, data),
      page,
      size,
      total,
    };
  }

  async findOne(id: string): Promise<AnswerEntity> {
    const record = await this.answerRepo.findOne({
      where: { id },
      relations: ['question'],
    });
    if (!record) {
      throw new NotFoundException(
        ERROR_MESSAGES.NOT_FOUND_WITH_ID(ENTITY_NAMES.ANSWER ?? 'Answer', id),
      );
    }
    return record;
  }

  async update(id: string, dto: UpdateAnswerDto): Promise<AnswerEntity> {
    const record = await this.findOne(id);

    if (dto.questionId) {
      await this.questionService.findOne(dto.questionId);
    }

    Object.assign(record, dto);
    return this.answerRepo.save(record);
  }

  async remove(id: string): Promise<void> {
    const record = await this.findOne(id);
    await this.answerRepo.remove(record);
  }

  async createBulk(answers: Partial<AnswerEntity>[]): Promise<AnswerEntity[]> {
    const records = this.answerRepo.create(answers);
    return this.answerRepo.save(records);
  }
}
