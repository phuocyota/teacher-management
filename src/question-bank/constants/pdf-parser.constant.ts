/**
 * PDF Parser Configuration Constants
 * Contains regex patterns, thresholds, and other configuration for PDF parsing
 */

export const PDF_PARSER_CONFIG = {
  /**
   * Regex pattern to detect question start line
   * Matches: "Câu 1:", "Question 1:", "Câu 1.", etc.
   */
  QUESTION_START_PATTERN: /^(?:Câu|Question)\s*(\d+)[:\.]?\s*(.*)$/i,

  /**
   * Regex pattern to detect answer line
   * Matches: "A) answer", "B. answer", "C) answer", "D. answer"
   */
  ANSWER_LINE_PATTERN: /^([A-D])[\.\)]\s+/,

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
