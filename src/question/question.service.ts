import {
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QuestionEntity } from './question.entity';
import {
  CreateQuestionDto,
  UpdateQuestionDto,
} from './dto/create-question.dto';
import { QuestionBankService } from 'src/question-bank/question-bank.service';
import {
  ERROR_MESSAGES,
  ENTITY_NAMES,
} from 'src/common/constant/error-messages.constant';
import { PaginationResponseDto } from 'src/common/dto/pagination.dto';
import { QuestionResponseDto } from './dto/question.dto';
import { autoMapListToDto } from 'src/common/utils/auto-map.util';

@Injectable()
export class QuestionService {
  constructor(
    @InjectRepository(QuestionEntity)
    private readonly questionRepo: Repository<QuestionEntity>,
    @Inject(forwardRef(() => QuestionBankService))
    private readonly questionBankService: QuestionBankService,
  ) {}

  async create(dto: CreateQuestionDto): Promise<QuestionEntity> {
    // Validate questionBankId exists
    await this.questionBankService.findOne(dto.questionBankId);

    const record = this.questionRepo.create(dto);
    return this.questionRepo.save(record);
  }

  async findAll(
    page = 1,
    size = 10,
    questionBankId?: string,
    questionType?: string,
  ): Promise<PaginationResponseDto<QuestionResponseDto>> {
    const skip = (page - 1) * size;

    const qb = this.questionRepo
      .createQueryBuilder('question')
      .leftJoinAndSelect('question.questionBank', 'questionBank');

    if (questionBankId) {
      qb.andWhere('question.questionBankId = :questionBankId', {
        questionBankId,
      });
    }

    if (questionType) {
      qb.andWhere('question.questionType = :questionType', { questionType });
    }

    qb.orderBy('question.createdAt', 'DESC');
    qb.skip(skip).take(size);

    const [data, total] = await qb.getManyAndCount();

    return {
      data: autoMapListToDto(QuestionResponseDto, data),
      page,
      size,
      total,
    };
  }

  async findOne(id: string): Promise<QuestionEntity> {
    const record = await this.questionRepo.findOne({
      where: { id },
      relations: ['questionBank'],
    });
    if (!record) {
      throw new NotFoundException(
        ERROR_MESSAGES.NOT_FOUND_WITH_ID(
          ENTITY_NAMES.QUESTION ?? 'Câu hỏi',
          id,
        ),
      );
    }
    return record;
  }

  async update(id: string, dto: UpdateQuestionDto): Promise<QuestionEntity> {
    const record = await this.findOne(id);

    if (dto.questionBankId) {
      await this.questionBankService.findOne(dto.questionBankId);
    }

    Object.assign(record, dto);
    return this.questionRepo.save(record);
  }

  async remove(id: string): Promise<void> {
    const record = await this.findOne(id);
    await this.questionRepo.remove(record);
  }

  async createBulk(
    questions: Partial<QuestionEntity>[],
  ): Promise<QuestionEntity[]> {
    const records = this.questionRepo.create(questions);
    return this.questionRepo.save(records);
  }
}
