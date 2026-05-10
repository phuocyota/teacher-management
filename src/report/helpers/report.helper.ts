import type { PDFFont } from 'pdf-lib';
import type { Row, Worksheet } from 'exceljs';
import type { SchoolAttemptReportFilters } from '../interfaces/report.interface';

export function setupSheetColumns(
  worksheet: Worksheet,
  widths: number[],
): void {
  worksheet.columns = widths.map((width) => ({ width }));
}

export function styleTableHeader(row: Row): void {
  row.font = { bold: true };
  row.alignment = {
    vertical: 'middle',
    horizontal: 'center',
    wrapText: true,
  };
  row.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'D9EAF7' },
    };
  });
}

export function styleDataRow(row: Row): void {
  row.alignment = {
    vertical: 'middle',
    horizontal: 'center',
    wrapText: true,
  };
}

export function copyRowStyle(
  source: Row,
  target: Row,
  totalColumns: number,
): void {
  target.height = source.height;
  for (let col = 1; col <= totalColumns; col += 1) {
    target.getCell(col).style = JSON.parse(
      JSON.stringify(source.getCell(col).style ?? {}),
    );
  }
}

export function styleStudentDetailRow(row: Row, bold = false): void {
  if (bold) {
    row.font = { bold: true };
  }
  row.alignment = {
    vertical: 'middle',
    horizontal: 'center',
    wrapText: true,
  };
}

export function clearFill(
  worksheet: Worksheet,
  fromRow: number,
  toRow: number,
  totalColumns: number,
): void {
  for (let rowIndex = fromRow; rowIndex <= toRow; rowIndex += 1) {
    const row = worksheet.getRow(rowIndex);
    for (let col = 1; col <= totalColumns; col += 1) {
      row.getCell(col).fill = {
        type: 'pattern',
        pattern: 'none',
      };
    }
  }
}

export function clearUnusedBorders(
  worksheet: Worksheet,
  fromRow: number,
  toRow: number,
  totalColumns: number,
): void {
  for (let rowIndex = fromRow; rowIndex <= toRow; rowIndex += 1) {
    const row = worksheet.getRow(rowIndex);
    for (let col = 1; col <= totalColumns; col += 1) {
      const cell = row.getCell(col);
      const hasValue =
        cell.value !== null && cell.value !== undefined && cell.value !== '';
      if (!hasValue) {
        cell.border = {};
      }
    }
  }
}

export function clearBorders(
  worksheet: Worksheet,
  fromRow: number,
  toRow: number,
  totalColumns: number,
): void {
  for (let rowIndex = fromRow; rowIndex <= toRow; rowIndex += 1) {
    const row = worksheet.getRow(rowIndex);
    for (let col = 1; col <= totalColumns; col += 1) {
      row.getCell(col).border = {};
    }
  }
}

export function applyTableBorder(
  worksheet: Worksheet,
  fromRow: number,
  toRow: number,
  totalColumns: number,
): void {
  for (let rowIndex = fromRow; rowIndex <= toRow; rowIndex += 1) {
    const row = worksheet.getRow(rowIndex);
    for (let col = 1; col <= totalColumns; col += 1) {
      const cell = row.getCell(col);
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    }
  }
}

export function getAssessmentLabel(score: number | null): string {
  if (score === null) {
    return 'Chua co du lieu';
  }
  if (score >= 8) {
    return 'Tot';
  }
  if (score >= 6.5) {
    return 'Kha';
  }
  if (score >= 5) {
    return 'Dat';
  }
  return 'Can ho tro';
}

export function normalizeOptionalFilter(value?: string): string | undefined {
  const normalized = value?.trim();
  if (!normalized || normalized.toLowerCase() === 'all') {
    return undefined;
  }
  return normalized;
}

export function toNullableNumber(
  value: string | number | null | undefined,
): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

export function toPdfText(value: string): string {
  return value
    .replace(/\u0111/g, 'd')
    .replace(/\u0110/g, 'D')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, '');
}

export function truncateForWidth(
  font: PDFFont,
  value: string,
  size: number,
  maxWidth?: number,
): string {
  if (!maxWidth || font.widthOfTextAtSize(value, size) <= maxWidth) {
    return value;
  }

  let truncated = value;
  while (
    truncated.length > 0 &&
    font.widthOfTextAtSize(`${truncated}...`, size) > maxWidth
  ) {
    truncated = truncated.slice(0, -1);
  }

  return truncated ? `${truncated}...` : '';
}

export function formatNullableScore(value: string | number | null): string {
  const score = toNullableNumber(value);
  return score === null ? '-' : score.toFixed(2);
}

export function formatDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function formatDateTime(value: Date): string {
  return value.toISOString().replace('T', ' ').slice(0, 19);
}

export function formatCompletionDuration(
  startedAt: Date,
  submittedAt: Date | null,
): string {
  if (!submittedAt) {
    return '-';
  }

  const durationInSeconds = Math.max(
    0,
    Math.floor(
      (new Date(submittedAt).getTime() - new Date(startedAt).getTime()) / 1000,
    ),
  );
  const hours = Math.floor(durationInSeconds / 3600);
  const minutes = Math.floor((durationInSeconds % 3600) / 60);
  const seconds = durationInSeconds % 60;

  if (hours > 0) {
    return `${hours} gio ${minutes} phut ${seconds} giay`;
  }

  if (minutes > 0) {
    return `${minutes} phut ${seconds} giay`;
  }

  return `${seconds} giay`;
}

export function formatReportFilters(
  filters: SchoolAttemptReportFilters,
): string {
  const parts = [
    filters.examSetId ? `Bo de: ${filters.examSetId}` : null,
    filters.questionBankId ? `De thi: ${filters.questionBankId}` : null,
    filters.fromDate ? `Tu ngay: ${filters.fromDate}` : null,
    filters.toDate ? `Den ngay: ${filters.toDate}` : null,
  ].filter(Boolean);

  return parts.length ? parts.join(' | ') : 'Bo loc: Tat ca bai lam';
}

export function formatAttemptStatusForExport(status: string | null): string {
  switch (status) {
    case 'DOING':
      return 'Dang lam';
    case 'SUBMITTED':
      return 'Hoan thanh';
    default:
      return status ?? '';
  }
}

export function toSafeFileName(value: string): string {
  return toPdfText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function toWorksheetName(value: string): string {
  const sanitized = toPdfText(value)
    .replace(/[:\\/?*\[\]]/g, ' ')
    .trim();

  return (sanitized || 'Sheet').slice(0, 31);
}
