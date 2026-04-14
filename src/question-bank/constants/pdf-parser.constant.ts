/**
 * PDF Parser Configuration Constants
 * Contains regex patterns, thresholds, and other configuration for PDF parsing
 */

export const PDF_PARSER_CONFIG = {
  /**
   * Regex pattern to detect question start line
   * Matches:
   * - "Câu 1:", "Question 1:", "Câu 1.", etc.
   * - "1. Question text", "11.Question text", "8.. Question text"
   */
  QUESTION_START_PATTERN:
    /^(?:(?:C\u00e2u|Question)\s*(\d+)\s*[:\.]?\s*(.*)|(\d+)\s*[\.:]+\s*(.*))$/i,

  /**
   * Regex pattern to detect answer line
   * Matches: "A) answer", "B. answer", "C) answer", "D.answer", "B . answer"
   */
  ANSWER_LINE_PATTERN: /^([A-D])\s*[\.\)]\s*/,

  /**
   * Regex pattern to split answer segments from a single line
   * Matches: "A. foo B . bar C) baz"
   */
  ANSWER_SEGMENT_PATTERN: /([A-D])\s*[\.\)]\s*/g,

  /**
   * Regex pattern to detect the start of answer key section
   * Matches: "Đáp án", "Đáp án:", "Answer Key"
   */
  ANSWER_KEY_START_PATTERN:
    /^(?:\u0110\u00e1p\s*\u00e1n|Answer\s*Key)\s*:?\s*$/i,

  /**
   * Regex pattern to detect answer key entries
   * Matches: "Câu 1: A", "Question 2. B"
   */
  ANSWER_KEY_ENTRY_PATTERN:
    /(?:C\u00e2u|Question)\s*(\d+)\s*[:.\-]?\s*([A-D])(?:\b|$)/gi,

  /**
   * Regex patterns to ignore repeated headers and footers after text is
   * normalized to lowercase ASCII and collapsed whitespace.
   */
  NOISE_LINE_PATTERNS: [
    /^CHƯƠNG\s+TRÌNH\s+GIÁO\s+DỤC\s+KỸ\s+NĂNG\s+SỐNG(?:\s*_?\s*ICHISKILL)?$/iu,
    /^Khối\s+\d+\s*\.\s*Đề kiểm tra học kì\s+[IVX]+\s+\d+$/iu,
    /^chuong trinh giao duc ky nang song(?:\s*_?\s*ichiskill)?$/,
    /^khoi\s+\d+\s*\.\s*de kiem tra hoc ki\s+[ivx]+\s+\d+$/,
  ],

  /**
   * Regex pattern to ignore standalone figure captions like "Hình 1"
   */
  FIGURE_LABEL_PATTERN: /^(?:H\u00ecnh|Hinh)\s+\d+[\.:]?$/i,

  /**
   * Tolerance (in pixels) for grouping fragments into same line
   * If vertical distance between fragments is <= this value, they're on same line
   */
  LINE_TOLERANCE: 3,

  /**
   * Threshold (in pixels) for horizontal alignment
   * Used to group fragments horizontally on same line
   */
  HORIZONTAL_DELTA_THRESHOLD: 0.5,

  /**
   * Starting order number for image fragments
   * Higher number ensures images are processed after text on same y-coordinate
   */
  IMAGE_ORDER_START: 100000,

  /**
   * Maximum time to wait for pdf.js to resolve an image object before skipping it.
   * This prevents a single unresolved XObject from stalling the whole page import.
   */
  IMAGE_OBJECT_TIMEOUT_MS: 2000,

  /**
   * Maximum time to wait for pdf.js document destroy to complete before
   * continuing the request lifecycle. Some PDFs can leave destroy pending.
   */
  PDF_DOCUMENT_DESTROY_TIMEOUT_MS: 3000,

  /**
   * PDF.js library worker and security options
   */
  PDF_WORKER_OPTIONS: {
    disableWorker: true,
    isEvalSupported: false,
    useWorkerFetch: false,
  },
};

/**
 * Answer option characters recognized in PDFs
 */
export const ANSWER_OPTIONS = ['A', 'B', 'C', 'D'] as const;
