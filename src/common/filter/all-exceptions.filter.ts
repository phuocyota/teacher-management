import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Interface cho response lỗi chuẩn
 */
interface ErrorResponse {
  statusCode: number;
  message: string;
  error: string;
  timestamp: string;
  path: string;
  method: string;
}

/**
 * Exception Filter để handle và log tất cả các lỗi trong ứng dụng
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Xác định status code và message
    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Lỗi hệ thống không xác định';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        const responseObj = exceptionResponse as Record<string, unknown>;
        message =
          (responseObj.message as string) ||
          (responseObj.error as string) ||
          message;
        error = (responseObj.error as string) || this.getErrorName(statusCode);
      }
    } else if (exception instanceof Error) {
      message = exception.message || message;
    }

    // Tạo error response
    const errorResponse: ErrorResponse = {
      statusCode,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
    };

    // Log lỗi với đầy đủ thông tin
    this.logError(request, exception, errorResponse);

    // Trả về response
    response.status(statusCode).json(errorResponse);
  }

  /**
   * Log lỗi với format chuẩn
   */
  private logError(
    request: Request,
    exception: unknown,
    errorResponse: ErrorResponse,
  ): void {
    const method = request.method;
    const url = request.url;
    const body = request.body as Record<string, unknown>;
    const userAgent = request.headers['user-agent'] || 'Unknown';
    const user = (request as Request & { user?: { userId?: string } }).user;
    const userId = user?.userId || 'Anonymous';

    const logMessage = {
      timestamp: errorResponse.timestamp,
      method,
      url,
      statusCode: errorResponse.statusCode,
      message: errorResponse.message,
      userId,
      userAgent,
      body: this.sanitizeBody(body),
    };

    // Log theo mức độ nghiêm trọng
    if (errorResponse.statusCode >= 500) {
      this.logger.error(
        `[${method}] ${url} - ${errorResponse.statusCode} - ${errorResponse.message}`,
        exception instanceof Error
          ? exception.stack
          : JSON.stringify(exception),
        JSON.stringify(logMessage),
      );
    } else if (errorResponse.statusCode >= 400) {
      this.logger.warn(
        `[${method}] ${url} - ${errorResponse.statusCode} - ${errorResponse.message}`,
        JSON.stringify(logMessage),
      );
    }
  }

  /**
   * Loại bỏ các thông tin nhạy cảm khỏi body trước khi log
   */
  private sanitizeBody(body: Record<string, unknown>): Record<string, unknown> {
    if (!body || typeof body !== 'object') {
      return body;
    }

    const sanitized = { ...body };
    const sensitiveFields = ['password', 'hashPassword', 'token', 'secret'];

    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '***HIDDEN***';
      }
    }

    return sanitized;
  }

  /**
   * Lấy tên lỗi dựa trên status code
   */
  private getErrorName(statusCode: number): string {
    const errorNames: Record<number, string> = {
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      409: 'Conflict',
      422: 'Unprocessable Entity',
      500: 'Internal Server Error',
      502: 'Bad Gateway',
      503: 'Service Unavailable',
    };

    return errorNames[statusCode] || 'Error';
  }
}
