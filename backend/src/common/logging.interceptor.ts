import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';
import type { User } from '@prisma/client';

/**
 * Structured request logging — one JSON line per request:
 *   {"type":"http","method":"PATCH","path":"/api/applications/9/status",
 *    "status":200,"ms":14,"userId":1,"role":"RECRUITER"}
 *
 * Deliberately logs METADATA ONLY — never bodies, headers, tokens, or query
 * values (query params could carry PII/search terms; the path is enough).
 * Errors are logged by the global filter; this captures the response side.
 */
@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest<Request & { user?: User }>();
    const start = Date.now();
    return next.handle().pipe(
      tap({
        next: () => {
          const res = ctx.switchToHttp().getResponse<Response>();
          this.write(req, res.statusCode, Date.now() - start, null);
        },
        error: (err) => {
          const res = ctx.switchToHttp().getResponse<Response>();
          this.write(req, res.statusCode || 500, Date.now() - start, err);
        },
      }),
    );
  }

  private write(req: Request & { user?: User }, status: number, ms: number, err: unknown) {
    process.stdout.write(JSON.stringify({
      type: 'http',
      method: req.method,
      path: req.baseUrl + req.path, // path only — no query string (may carry PII)
      status,
      ms,
      userId: req.user?.id ?? null,
      role: req.user?.role ?? null,
      ...(err ? { error: (err as Error).constructor.name } : {}),
    }) + '\n');
  }
}
