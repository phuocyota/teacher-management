import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QuestionBankEntity } from 'src/question-bank/question-bank.entity';
import { Repository } from 'typeorm';
import {
  CreateQuestionBankSectionDto,
  UpdateQuestionBankSectionDto,
} from './dto/question-bank-section.dto';
import { QuestionBankSectionEntity } from './question-bank-section.entity';

@Injectable()
export class QuestionBankSectionService {
  constructor(
    @InjectRepository(QuestionBankSectionEntity)
    private readonly sectionRepo: Repository<QuestionBankSectionEntity>,
    @InjectRepository(QuestionBankEntity)
    private readonly questionBankRepo: Repository<QuestionBankEntity>,
  ) {}

  async create(
    dto: CreateQuestionBankSectionDto,
  ): Promise<QuestionBankSectionEntity> {
    await this.ensureQuestionBankExists(dto.questionBankId);
    await this.ensureOrderAvailable(dto.questionBankId, dto.orderNo);

    return this.sectionRepo.save(this.sectionRepo.create(dto));
  }

  findAll(questionBankId: string): Promise<QuestionBankSectionEntity[]> {
    return this.sectionRepo.find({
      where: { questionBankId },
      order: { orderNo: 'ASC' },
    });
  }

  async findOne(id: string): Promise<QuestionBankSectionEntity> {
    const section = await this.sectionRepo.findOne({ where: { id } });

    if (!section) {
      throw new NotFoundException(`Không tìm thấy phần đề thi với ID ${id}`);
    }

    return section;
  }

  async update(
    id: string,
    dto: UpdateQuestionBankSectionDto,
  ): Promise<QuestionBankSectionEntity> {
    const section = await this.findOne(id);
    const questionBankId = dto.questionBankId ?? section.questionBankId;
    const orderNo = dto.orderNo ?? section.orderNo;

    if (dto.questionBankId && dto.questionBankId !== section.questionBankId) {
      throw new BadRequestException(
        'Không thể chuyển phần đề thi sang ngân hàng câu hỏi khác',
      );
    }

    await this.ensureOrderAvailable(questionBankId, orderNo, id);
    Object.assign(section, dto);
    return this.sectionRepo.save(section);
  }

  async remove(id: string): Promise<void> {
    const section = await this.findOne(id);
    await this.sectionRepo.remove(section);
  }

  async ensureBelongsToQuestionBank(
    sectionId: string,
    questionBankId: string,
  ): Promise<QuestionBankSectionEntity> {
    const section = await this.findOne(sectionId);

    if (section.questionBankId !== questionBankId) {
      throw new BadRequestException(
        'Phần đề thi không thuộc ngân hàng câu hỏi đã chọn',
      );
    }

    return section;
  }

  private async ensureQuestionBankExists(
    questionBankId: string,
  ): Promise<void> {
    const exists = await this.questionBankRepo.exists({
      where: { id: questionBankId },
    });

    if (!exists) {
      throw new NotFoundException(
        `Không tìm thấy ngân hàng câu hỏi với ID ${questionBankId}`,
      );
    }
  }

  private async ensureOrderAvailable(
    questionBankId: string,
    orderNo: number,
    excludedId?: string,
  ): Promise<void> {
    const existing = await this.sectionRepo.findOne({
      where: { questionBankId, orderNo },
    });

    if (existing && existing.id !== excludedId) {
      throw new BadRequestException(
        `Thứ tự phần ${orderNo} đã tồn tại trong ngân hàng câu hỏi`,
      );
    }
  }
}
