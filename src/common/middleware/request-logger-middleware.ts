import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    console.log('➡️ REQUEST IN', {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      body: req.body ? JSON.stringify(req.body) : null,
    });
    next();
  }
}
