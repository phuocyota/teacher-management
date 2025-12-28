import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';

@Injectable()
export class ResponseLoggerInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();
    const start = Date.now();

    return next.handle().pipe(
      tap((data) => {
        const duration = Date.now() - start;

        console.log('⬅️ RESPONSE OUT', {
          statusCode: res.statusCode,
          duration: `${duration}ms`,
          response: data,
        });
      }),
    );
  }
}
