import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

/**
 * Global error contract — every error leaves the API as:
 *   { "success": false, "error": { "code": "JOB_NOT_FOUND", "message": "..." } }
 *
 * code: an exception may carry its own `code` in its response body
 * (throw new NotFoundException({ code: 'JOB_NOT_FOUND', message: '...' }));
 * otherwise it derives from the HTTP status (NOT_FOUND, FORBIDDEN…).
 * Validation errors (class-validator message arrays) → VALIDATION_FAILED.
 *
 * Internal (non-HttpException) errors → generic 500 + server-side log —
 * stack traces NEVER reach the client.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    if (!(exception instanceof HttpException)) {
      this.logger.error('Unhandled error', (exception as Error)?.stack);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
      });
    }

    const status = exception.getStatus();
    const body = exception.getResponse();
    const payload =
      typeof body === 'object' && body !== null
        ? (body as Record<string, unknown>)
        : { message: body };

    const message = Array.isArray(payload.message)
      ? (payload.message as string[]).join('; ')
      : typeof payload.message === 'string'
        ? payload.message
        : exception.message;

    const code =
      typeof payload.code === 'string'
        ? payload.code
        : Array.isArray(payload.message)
          ? 'VALIDATION_FAILED'
          : (HttpStatus[status] ?? 'ERROR');

    res.status(status).json({ success: false, error: { code, message } });
  }
}
