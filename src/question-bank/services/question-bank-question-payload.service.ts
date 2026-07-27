import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { QuestionBankQuestionEntity } from 'src/question-bank-question/question-bank-question.entity';
import { QuestionEntity } from 'src/question/question.entity';
import { AnswerEntity } from 'src/answer/answer.entity';

export interface QuestionBankQuestionPayload {
  links: QuestionBankQuestionEntity[];
  rootQuestions: QuestionEntity[];
  answersByQuestionId: Map<string, AnswerEntity[]>;
}

@Injectable()
export class QuestionBankQuestionPayloadService {
  constructor(
    @InjectRepository(QuestionBankQuestionEntity)
    private readonly questionBankQuestionRepo: Repository<QuestionBankQuestionEntity>,
    @InjectRepository(QuestionEntity)
    private readonly questionRepo: Repository<QuestionEntity>,
    @InjectRepository(AnswerEntity)
    private readonly answerRepo: Repository<AnswerEntity>,
  ) {}

  async buildQuestionBankQuestionPayload(
    questionBankId: string,
  ): Promise<QuestionBankQuestionPayload> {
    const links = await this.questionBankQuestionRepo.find({
      where: { questionBankId },
      relations: ['section'],
      order: { orderNo: 'ASC' },
    });
    const questionIds = links.map((item) => item.questionId);
    const rootQuestions = questionIds.length
      ? await this.questionRepo.find({ where: { id: In(questionIds) } })
      : [];
    const answersByQuestionId =
      await this.loadRootAnswersByQuestionIds(questionIds);

    return {
      links,
      rootQuestions,
      answersByQuestionId,
    };
  }

  private async loadRootAnswersByQuestionIds(
    questionIds: string[],
  ): Promise<Map<string, AnswerEntity[]>> {
    const answersByQuestionId = new Map<string, AnswerEntity[]>();

    if (questionIds.length === 0) {
      return answersByQuestionId;
    }

    const allAnswers = await this.answerRepo.find({
      where: { questionId: In(questionIds) },
      order: { createdAt: 'ASC' },
    });
    const filteredAnswers = allAnswers.filter(
      (answer) => !this.isAnswerKeyNode(answer),
    );

    const referencedAnswerIds = new Set(
      filteredAnswers.map((answer) => answer.nextContent).filter(Boolean),
    );

    for (const answer of filteredAnswers) {
      if (referencedAnswerIds.has(answer.id)) {
        continue;
      }

      const items = answersByQuestionId.get(answer.questionId) ?? [];
      items.push(answer);
      answersByQuestionId.set(answer.questionId, items);
    }

    return answersByQuestionId;
  }

  private isAnswerKeyNode(answer: AnswerEntity): boolean {
    if (answer.contentType !== 'TEXT') {
      return false;
    }

    const text = answer.content?.trim() ?? '';
    return /^(\*|\u2022)?\s*(Đáp\s*án|Dap\s*an|Answer\s*Key)\b/iu.test(text);
  }
}
