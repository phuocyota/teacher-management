/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
type Constructor<T extends object> = new (...args: any[]) => T;

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

export function autoMapToDto<T extends object>(
  dtoClass: Constructor<T>,
  raw: Record<string, any>,
): T {
  const dto = new dtoClass();

  for (const [key, value] of Object.entries(raw)) {
    if (value === null || value === undefined) {
      (dto as any)[key] = value;
      continue;
    }

    // ===== NUMBER =====
    if (typeof value === 'string' && /^[0-9]+(\.[0-9]+)?$/.test(value)) {
      (dto as any)[key] = Number(value);
      continue;
    }

    // ===== DATE (ISO ONLY) =====
    if (typeof value === 'string' && ISO_DATE_REGEX.test(value)) {
      (dto as any)[key] = new Date(value);
      continue;
    }

    // ===== KEEP STRING (UUID, URL, TEXT) =====
    if (typeof value === 'string') {
      (dto as any)[key] = value;
      continue;
    }

    // ===== OBJECT / ARRAY =====
    if (typeof value === 'object') {
      (dto as any)[key] = value;
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
