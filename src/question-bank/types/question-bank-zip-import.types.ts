import {
  ParsedDocumentResult,
  ParsedSection,
} from './question-bank-import.types';

export interface ZipArchiveEntry {
  path: string;
  originalName: string;
  extension: string;
  size: number;
  buffer: Buffer;
}

export interface ZipAudioEntry extends ZipArchiveEntry {
  mimetype: string;
  normalizedLabel: string;
}

export interface StructuredExamParseResult {
  document: ParsedDocumentResult;
  sections: ParsedSection[];
}

export interface ImportedAudioFile {
  id: string;
  label: string;
  originalName: string;
  path: string;
  mimetype: string;
  size: number;
  sectionId: string;
}

export interface ImportedZipSection {
  id: string;
  title: string;
  instruction?: string | null;
  orderNo: number;
  meta?: Record<string, unknown> | null;
}

export interface InspectedExamZip {
  pdf: ZipArchiveEntry;
  audioFiles: ZipAudioEntry[];
  warnings: string[];
}
