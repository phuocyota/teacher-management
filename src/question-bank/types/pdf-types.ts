/**
 * TypeScript interfaces for pdf.js-dist types
 * Provides type safety for PDF.js library
 */

export interface PdfOperatorList {
  fnArray: number[];
  argsArray: any[][];
}

export interface PdfViewport {
  scale: number;
  rotation: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  transform: number[];
}

export interface PdfTextItem {
  str: string;
  dir: string;
  width: number;
  height: number;
  transform: number[];
  fontName: string;
  hasEOL: boolean;
}

export interface PdfTextContent {
  items: PdfTextItem[];
  styles: Record<string, any>;
}

export interface PdfPage {
  getViewport(options: { scale: number }): PdfViewport;
  getTextContent(options?: {
    normalizeWhitespace?: boolean;
    disableCombineTextItems?: boolean;
  }): Promise<PdfTextContent>;
  getOperatorList(): Promise<PdfOperatorList>;
  cleanup?(): boolean;
  objs: {
    get(name: string): any;
    get(name: string, callback: (obj: any) => void): void;
    has(name: string): boolean;
  };
  imageCoordinates?: ArrayLike<number> | null;
  render(options: any): Promise<void> | { promise: Promise<void> };
}

export interface PdfDocument {
  numPages: number;
  getPage(pageNum: number): Promise<PdfPage>;
  destroy(): Promise<void>;
}

export interface PdfJsLib {
  getDocument(options: {
    data: Uint8Array;
    disableWorker: boolean;
    isEvalSupported: boolean;
    useWorkerFetch: boolean;
  }): {
    promise: Promise<PdfDocument>;
    destroy(): void;
  };
  OPS: {
    save: number;
    restore: number;
    transform: number;
    paintImageXObject: number;
    paintJpegXObject: number;
    paintImageMaskXObject: number;
    paintInlineImageXObject: number;
  };
  Util: {
    transform(m1: number[], m2: number[]): number[];
  };
}

export interface PdfCanvas {
  width: number;
  height: number;
  toBuffer(mimeType?: string): Buffer;
  getContext(contextId: '2d'): any;
}

export interface ImageObject {
  data: Buffer | Uint8Array | Uint8ClampedArray;
  width: number;
  height: number;
  kind?: string;
}
