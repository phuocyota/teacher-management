import { ContentTypes } from 'src/common/enum/content-type.enum';
import { AttemptService } from './attempt.service';
import { QuestionType } from 'src/question/enum/question-type.enum';

describe('AttemptService', () => {
  it('maps nextContent from loaded chain when root entity nextContent is missing', () => {
    const service = createService();

    const questionResult = (service as any).mapQuestionChain([
      {
        id: 'question-1',
        type: QuestionType.SINGLE_CHOICE,
        contentType: ContentTypes.TEXT,
        content: 'Question text',
        meta: null,
        nextContent: null,
      },
      {
        id: 'question-2',
        type: QuestionType.SINGLE_CHOICE,
        contentType: ContentTypes.IMAGE,
        content: '/uploads/question-image.png',
        meta: null,
        nextContent: null,
      },
    ]);
    const answerResult = (service as any).mapAnswerChain([
      {
        id: 'answer-1',
        contentType: ContentTypes.TEXT,
        content: 'Answer text',
        meta: null,
        nextContent: null,
      },
      {
        id: 'answer-2',
        contentType: ContentTypes.IMAGE,
        content: '/uploads/answer-image.png',
        meta: null,
        nextContent: null,
      },
    ]);

    expect(questionResult[0].nextContent).toBe('question-2');
    expect(questionResult[1].nextContent).toBeNull();
    expect(answerResult.nextContent).toBe('answer-2');
    expect(answerResult.chain[0].nextContent).toBe('answer-2');
    expect(answerResult.chain[1].nextContent).toBeNull();
  });
});

function createService(): AttemptService {
  return new AttemptService(
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );
}
