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
import {
  AnswerResponseDto,
  AnswerChainResponseDto,
  AnswerChainNodeDto,
} from './dto/answer.dto';
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

    // Load nextContentDetails for all answers that have nextContent
    const answersWithDetails = await Promise.all(
      data.map(async (answer) => {
        if (answer.nextContent) {
          const nextContentEntity = await this.answerRepo.findOne({
            where: { id: answer.nextContent },
            select: ['id', 'content', 'contentType', 'meta'],
          });

          if (nextContentEntity) {
            (answer as any).nextContentDetails = {
              id: nextContentEntity.id,
              content: nextContentEntity.content,
              contentType: nextContentEntity.contentType,
              meta: nextContentEntity.meta,
            };
          }
        }
        return answer;
      }),
    );

    return {
      data: autoMapListToDto(AnswerResponseDto, answersWithDetails),
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

    // Load nextContent details if exists
    if (record.nextContent) {
      const nextContentEntity = await this.answerRepo.findOne({
        where: { id: record.nextContent },
        select: ['id', 'content', 'contentType', 'meta'],
      });

      if (nextContentEntity) {
        (record as any).nextContentDetails = {
          id: nextContentEntity.id,
          content: nextContentEntity.content,
          contentType: nextContentEntity.contentType,
          meta: nextContentEntity.meta,
        };
      }
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

  async updateBulk(answers: Partial<AnswerEntity>[]): Promise<AnswerEntity[]> {
    return this.answerRepo.save(answers);
  }

  /**
   * Get answer with full content chain (following nextContent links)
   * Returns array of answer parts in order
   */
  async getAnswerWithChain(id: string): Promise<AnswerChainResponseDto> {
    const chain: AnswerEntity[] = [];
    let currentId: string | undefined = id;

    // Follow the chain up to 10 levels (prevent infinite loops)
    const maxDepth = 10;
    let depth = 0;

    while (currentId && depth < maxDepth) {
      const answer = await this.answerRepo.findOne({
        where: { id: currentId },
        relations: ['question'],
      });

      if (!answer) {
        break;
      }

      chain.push(answer);
      currentId = answer.nextContent;
      depth++;
    }

    if (chain.length === 0) {
      throw new NotFoundException(
        ERROR_MESSAGES.NOT_FOUND_WITH_ID(ENTITY_NAMES.ANSWER ?? 'Answer', id),
      );
    }

    return this.buildChainResponse(chain);
  }

  private buildChainResponse(chain: AnswerEntity[]): AnswerChainResponseDto {
    const root = chain[0];

    return {
      id: root.id,
      contentType: root.contentType,
      content: root.content,
      meta: root.meta,
      nextContent: root.nextContent ?? chain[1]?.id ?? null,
      chain: chain.map((answer, index) => this.toChainNode(answer, chain[index + 1])),
    };
  }

  private toChainNode(
    answer: AnswerEntity,
    nextAnswer?: AnswerEntity,
  ): AnswerChainNodeDto {
    return {
      id: answer.id,
      content: answer.content,
      contentType: answer.contentType,
      meta: answer.meta,
      nextContent: nextAnswer?.id ?? answer.nextContent ?? null,
    };
  }
}
