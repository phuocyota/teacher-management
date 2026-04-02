/**
 * Custom error class for PDF parsing operations
 * Provides additional context like page number and parsing state
 */
export class PdfParsingError extends Error {
  constructor(
    message: string,
    public readonly pageNumber?: number,
    public readonly context?: Record<string, any>,
  ) {
    super(message);
    this.name = 'PdfParsingError';
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Get formatted error message with context
   */
  getDetailedMessage(): string {
    let msg = this.message;

    if (this.pageNumber) {
      msg += ` [Page ${this.pageNumber}]`;
    }

    if (this.context) {
      const contextStr = Object.entries(this.context)
        .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
        .join(', ');
      msg += ` {${contextStr}}`;
    }

    return msg;
  }
}
