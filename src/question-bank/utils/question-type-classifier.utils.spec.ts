import { ContentTypes } from 'src/common/enum/content-type.enum';
import { QuestionType } from 'src/question/enum/question-type.enum';
import { classifyQuestionType } from './question-type-classifier.utils';

describe('classifyQuestionType', () => {
  it('detects single choice questions from answer blocks', () => {
    expect(
      classifyQuestionType({
        stemParts: [
          { content: 'Chon dap an dung', contentType: ContentTypes.TEXT },
        ],
        answers: [
          {
            label: 'A',
            parts: [{ content: 'Lua chon A', contentType: ContentTypes.TEXT }],
          },
          {
            label: 'B',
            parts: [{ content: 'Lua chon B', contentType: ContentTypes.TEXT }],
          },
        ],
      }),
    ).toEqual({
      kind: 'single_choice',
      questionType: QuestionType.SINGLE_CHOICE,
      layoutKey: 'text_only_stem_text_only_answers',
    });
  });

  it('detects essay questions when there are no answers', () => {
    expect(
      classifyQuestionType({
        stemParts: [
          { content: 'Neu buon em se lam gi?', contentType: ContentTypes.TEXT },
        ],
        answers: [],
      }),
    ).toEqual({
      kind: 'text_input',
      questionType: QuestionType.TEXT_INPUT,
      layoutKey: null,
    });
  });

  it('detects matching and ordering hints before persistence', () => {
    expect(
      classifyQuestionType({
        stemParts: [
          {
            content: 'Em hay noi cot A voi cot B',
            contentType: ContentTypes.TEXT,
          },
        ],
        answers: [],
      }),
    ).toEqual({
      kind: 'matching',
      questionType: QuestionType.MATCHING,
      layoutKey: null,
    });

    expect(
      classifyQuestionType({
        stemParts: [
          {
            content: 'Em hay sap xep cac buoc theo thu tu dung',
            contentType: ContentTypes.TEXT,
          },
        ],
        answers: [],
      }),
    ).toEqual({
      kind: 'ordering',
      questionType: QuestionType.ORDERING,
      layoutKey: null,
    });
  });

  it('does not classify generic "noi" text as matching', () => {
    expect(
      classifyQuestionType({
        stemParts: [
          {
            content: 'Noi dung nao em khong nen xem?',
            contentType: ContentTypes.TEXT,
          },
        ],
        answers: [
          {
            label: 'A',
            parts: [{ content: 'Video day ve tranh', contentType: ContentTypes.TEXT }],
          },
          {
            label: 'B',
            parts: [{ content: 'Bai hat thieu nhi', contentType: ContentTypes.TEXT }],
          },
        ],
      }),
    ).toEqual({
      kind: 'single_choice',
      questionType: QuestionType.SINGLE_CHOICE,
      layoutKey: 'text_only_stem_text_only_answers',
    });

    expect(
      classifyQuestionType({
        stemParts: [
          {
            content:
              'Khi tham gia lop hoc online, Minh bat micro noi chuyen rieng voi ban trong luc giao vien dang giang bai.',
            contentType: ContentTypes.TEXT,
          },
        ],
        answers: [],
      }),
    ).toEqual({
      kind: 'text_input',
      questionType: QuestionType.TEXT_INPUT,
      layoutKey: null,
    });
  });

  it('detects the layout for text-plus-image stem with image-only answers', () => {
    expect(
      classifyQuestionType({
        stemParts: [
          {
            content: 'Em hay giup Ro bot di chuyen den dich',
            contentType: ContentTypes.TEXT,
          },
          {
            content: 'maze-image',
            contentType: ContentTypes.IMAGE,
          },
        ],
        answers: [
          {
            label: 'A',
            parts: [{ content: 'up-arrow', contentType: ContentTypes.IMAGE }],
          },
          {
            label: 'B',
            parts: [{ content: 'right-arrow', contentType: ContentTypes.IMAGE }],
          },
          {
            label: 'C',
            parts: [{ content: 'left-arrow', contentType: ContentTypes.IMAGE }],
          },
        ],
      }),
    ).toEqual({
      kind: 'single_choice',
      questionType: QuestionType.SINGLE_CHOICE,
      layoutKey: 'text_with_image_stem_image_only_answers',
    });
  });
});
