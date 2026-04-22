const MATCHING_PROMPT_PATTERN = /(noi|ghep|match)/i;
const COLUMN_A_PATTERN = /cot\s*a/i;
const COLUMN_B_PATTERN = /cot\s*b/i;

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
