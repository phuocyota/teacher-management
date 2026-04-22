import { ContentTypes } from 'src/common/enum/content-type.enum';
import {
  detectContentLayoutShape,
  detectMultipleChoiceLayout,
  MULTIPLE_CHOICE_LAYOUTS,
} from './multiple-choice-layouts.constant';

describe('multiple-choice-layouts', () => {
  it('contains the text + image stem with image-only answers layout', () => {
    expect(
      MULTIPLE_CHOICE_LAYOUTS.find(
        (layout) => layout.key === 'text_with_image_stem_image_only_answers',
      ),
    ).toMatchObject({
      stemShape: 'text_with_image',
      answerShape: 'image_only',
      supportsAnswerCounts: [2, 3, 4],
    });
  });

  it('detects the layout for a maze-style question with 3 image answers', () => {
    const layout = detectMultipleChoiceLayout(
      [
        {
          content: 'Em hay giup Ro bot di chuyen den dich',
          contentType: ContentTypes.TEXT,
        },
        {
          content: 'maze-image',
          contentType: ContentTypes.IMAGE,
        },
      ],
      [
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
    );

    expect(layout).toMatchObject({
      key: 'text_with_image_stem_image_only_answers',
      stemShape: 'text_with_image',
      answerShape: 'image_only',
      answerCount: 3,
    });
  });

  it('classifies content shapes correctly', () => {
    expect(
      detectContentLayoutShape([
        { content: 'text', contentType: ContentTypes.TEXT },
      ]),
    ).toBe('text_only');
    expect(
      detectContentLayoutShape([
        { content: 'image', contentType: ContentTypes.IMAGE },
      ]),
    ).toBe('image_only');
    expect(
      detectContentLayoutShape([
        { content: 'text', contentType: ContentTypes.TEXT },
        { content: 'image', contentType: ContentTypes.IMAGE },
      ]),
    ).toBe('text_with_image');
  });
});
