/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
type Constructor<T extends object> = new (...args: any[]) => T;

export function autoMapToDto<T extends object>(
  dtoClass: Constructor<T>,
  raw: Record<string, any>,
): T {
  const dto = new dtoClass();

  for (const key of Object.keys(dto)) {
    if (!(key in raw)) continue;

    const value = raw[key];

    if (typeof value === 'string' && !isNaN(Number(value))) {
      (dto as any)[key] = Number(value);
      continue;
    }

    if (
      value &&
      (key.toLowerCase().includes('date') || key.toLowerCase().includes('at'))
    ) {
      (dto as any)[key] = new Date(value);
      continue;
    }

    (dto as any)[key] = value;
  }

  return dto;
}

export function autoMapListToDto<T extends object>(
  dtoClass: new () => T,
  raws: Record<string, any>[],
): T[] {
  return raws.map((raw) => autoMapToDto(dtoClass, raw));
}
