import { DataSource } from 'typeorm';
import { join } from 'path';
import { QuestionEntity } from 'src/question/question.entity';
import { QuestionService } from 'src/question/question.service';
import { AnswerEntity } from 'src/answer/answer.entity';
import { AnswerService } from 'src/answer/answer.service';
import { ExamSetService } from 'src/exam-set/exam-set.service';
import { ExamSetEntity } from 'src/exam-set/exam-set.entity';
import { ExamSetQuestionBankEntity } from 'src/exam-set-question-bank/exam-set-question-bank.entity';
import { ExamSetClassEntity } from 'src/exam-set-class/exam-set-class.entity';
import { QuestionBankEntity } from 'src/question-bank/question-bank.entity';
import { QuestionBankService } from 'src/question-bank/services/question-bank.service';
import { NotFoundException } from '@nestjs/common';

// Use real PostgreSQL metadata/query generation without connecting to a database.
describe('joined read queries', () => {
  let db: DataSource;

  beforeAll(async () => {
    db = new DataSource({
      type: 'postgres',
      entities: [join(__dirname, '../**/*.entity.ts').replace(/\\/g, '/')],
    });
    await (db as any).buildMetadatas();
  });

  afterEach(() => jest.restoreAllMocks());

  it('returns zero sections for an existing bank and 404 for a missing bank', async () => {
    const repo = db.getRepository(QuestionBankEntity);
    const query = repo.createQueryBuilder('bank');
    jest.spyOn(repo, 'createQueryBuilder').mockReturnValue(query);
    const read = jest
      .spyOn(query, 'getRawOne')
      .mockResolvedValueOnce({ id: 'bank1', sectionCount: '0' })
      .mockResolvedValueOnce(undefined);
    const getStructure = (id: string) =>
      QuestionBankService.prototype.getStructure.call(
        { questionBankRepo: repo } as any,
        id,
      );
    await expect(getStructure('bank1')).resolves.toEqual({ sectionCount: 0 });
    const [sql, params] = query.getQueryAndParameters();
    expect(sql).toContain('LEFT JOIN "question_bank_section"');
    expect(sql).toContain('COUNT("section"."id")');
    expect(params).toEqual(['bank1']);
    await expect(getStructure('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('joins question content while retaining bank/type filters and pagination', async () => {
    const repo = db.getRepository(QuestionEntity);
    const query = repo.createQueryBuilder('question');
    jest.spyOn(repo, 'createQueryBuilder').mockReturnValue(query);
    jest
      .spyOn(query, 'getManyAndCount')
      .mockResolvedValue([
        [
          {
            id: 'q1',
            nextContentDetails: { id: 'q2', content: 'Extra' },
          } as any,
        ],
        12,
      ]);
    const findOne = jest.spyOn(repo, 'findOne');
    const service = new QuestionService(
      repo,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    const result = await service.findAll(2, 5, 'bank-id', 'TEXT');
    const [sql, params] = query.getQueryAndParameters();
    expect(sql).toContain('LEFT JOIN "question" "nextContentDetails"');
    expect(sql).toContain('INNER JOIN "question_bank_question"');
    expect(params).toEqual(expect.arrayContaining(['bank-id', 'TEXT', true]));
    expect(query.expressionMap.skip).toBe(5);
    expect(query.expressionMap.take).toBe(5);
    expect(result.total).toBe(12);
    expect((result.data[0] as any).nextContentDetails.content).toBe('Extra');
    expect(findOne).not.toHaveBeenCalled();
  });

  it('joins answer content and keeps answers with no next content', async () => {
    const repo = db.getRepository(AnswerEntity);
    const query = repo.createQueryBuilder('answer');
    jest.spyOn(repo, 'createQueryBuilder').mockReturnValue(query);
    jest
      .spyOn(query, 'getManyAndCount')
      .mockResolvedValue([[{ id: 'a1', nextContentDetails: null } as any], 1]);
    const findOne = jest.spyOn(repo, 'findOne');
    const result = await new AnswerService(repo, {} as any).findAll(
      1,
      10,
      'q1',
    );
    const [sql, params] = query.getQueryAndParameters();
    expect(sql).toContain('LEFT JOIN "answer" "nextContentDetails"');
    expect(sql).toContain('LEFT JOIN "question" "question"');
    expect(params).toContain('q1');
    expect(result.data).toHaveLength(1);
    expect((result.data[0] as any).nextContentDetails).toBeUndefined();
    expect(findOne).not.toHaveBeenCalled();
  });

  it('counts questions and sections independently and maps counts by link id', async () => {
    const repo = db.getRepository(ExamSetQuestionBankEntity);
    const query = repo.createQueryBuilder('link');
    jest.spyOn(repo, 'createQueryBuilder').mockReturnValue(query);
    jest.spyOn(query, 'getRawAndEntities').mockResolvedValue({
      entities: [
        { id: 'link1', questionBank: { id: 'b1', totalQuestions: null } },
        { id: 'link2', questionBank: { id: 'b2', totalQuestions: 7 } },
      ] as any,
      raw: [
        { countLinkId: 'link2', questionCount: '0', sectionCount: '0' },
        { countLinkId: 'link1', questionCount: '10', sectionCount: '2' },
      ],
    });
    const service = new ExamSetService(
      db.getRepository(ExamSetEntity),
      repo,
      db.getRepository(ExamSetClassEntity),
      {} as any,
    );
    jest
      .spyOn(service as any, 'findOneEntity')
      .mockResolvedValue({ id: 'exam' });
    jest.spyOn(service as any, 'getClassLinks').mockResolvedValue([]);
    const result = await service.findOne('exam');
    const [sql, params] = query.getQueryAndParameters();
    expect(sql).toContain('INNER JOIN "question_bank" "bank"');
    expect(sql.match(/SELECT COUNT\(\*\)/g)).toHaveLength(2);
    expect(sql).toContain('"questionLink"."question_bank_id" = "bank"."id"');
    expect(sql).toContain('"section"."question_bank_id" = "bank"."id"');
    expect(params).toEqual(['exam']);
    expect(
      result.questionBanks.map((bank) => [
        bank.totalQuestions,
        bank.sectionCount,
      ]),
    ).toEqual([
      [10, 2],
      [7, 0],
    ]);
  });
});
