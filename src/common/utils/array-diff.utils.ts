export interface ArrayDiffResult<T> {
  toAdd: T[];
  toRemove: T[];
}

/**
 * So sánh 2 mảng (current vs next) để lấy phần tử cần add / remove
 *
 * @param current - danh sách hiện tại (DB)
 * @param next - danh sách mới (request)
 */
export function diffArray<T>(
  current: readonly T[],
  next: readonly T[],
): ArrayDiffResult<T> {
  const currentSet = new Set(current);
  const nextSet = new Set(next);

  const toAdd: T[] = [];
  const toRemove: T[] = [];

  for (const item of nextSet) {
    if (!currentSet.has(item)) {
      toAdd.push(item);
    }
  }

  for (const item of currentSet) {
    if (!nextSet.has(item)) {
      toRemove.push(item);
    }
  }

  return { toAdd, toRemove };
}
