import { LayoutFragment } from '../types/question-bank-import.types';

const MATCHING_PROMPT_PATTERN = /(noi|ghep|match)/i;
const COLUMN_A_PATTERN = /cot\s*a/i;
const COLUMN_B_PATTERN = /cot\s*b/i;

const TEXT_FRAGMENT_SPACE_THRESHOLD = 1.5;

export function normalizeImportText(value: string): string {
  return value.replace(/\s+/g, ' ').replace(/\u00a0/g, ' ').trim();
}

export function normalizeImportSignature(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u0111\u0110]/g, 'd')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function mergeImportText(currentLine: string, fragment: string): string {
  const normalizedFragment = fragment.trim();

  if (!currentLine) {
    return normalizedFragment;
  }

  if (!normalizedFragment) {
    return currentLine;
  }

  return `${currentLine} ${normalizedFragment}`;
}

export function joinTextFragments(
  fragments: Array<Pick<LayoutFragment, 'content' | 'x' | 'width' | 'kind'>>,
): string {
  const textFragments = fragments.filter(
    (
      fragment,
    ): fragment is Pick<LayoutFragment, 'content' | 'x' | 'width'> & {
      kind: 'text';
    } => fragment.kind === 'text' && typeof fragment.content === 'string',
  );

  let text = '';
  let previousFragment: (typeof textFragments)[number] | null = null;

  for (const fragment of textFragments) {
    const content = fragment.content.trim();

    if (!content) {
      continue;
    }

    if (!previousFragment) {
      text = content;
      previousFragment = fragment;
      continue;
    }

    const previousRight = previousFragment.x + (previousFragment.width ?? 0);
    const gap = fragment.x - previousRight;
    const shouldInsertSpace = gap > TEXT_FRAGMENT_SPACE_THRESHOLD;

    text += shouldInsertSpace ? ` ${content}` : content;
    previousFragment = fragment;
  }

  return normalizeImportText(text);
}

export function cloneImportPattern(pattern: RegExp): RegExp {
  return new RegExp(pattern.source, pattern.flags);
}

export function hasMatchingColumnsContext(signature: string): boolean {
  return (
    MATCHING_PROMPT_PATTERN.test(signature) &&
    COLUMN_A_PATTERN.test(signature) &&
    COLUMN_B_PATTERN.test(signature)
  );
}
