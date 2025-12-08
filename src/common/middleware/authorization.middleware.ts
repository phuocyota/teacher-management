import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { JwtPayload } from '../interface/jwt-payload.interface';

@Injectable()
export class AuthorizationMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers['authorization'];

    if (!authHeader) {
      throw new UnauthorizedException('Missing Authorization header');
    }

    const token = authHeader.replace('Bearer ', '');

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;

      // --- Kiểm tra token phải có các trường bắt buộc ---
      if (!decoded.userId || !decoded.userType || !decoded.deviceId) {
        throw new UnauthorizedException(
          'Invalid token structure (missing fields)',
        );
      }

      // --- Gắn user vào req ---
      (req as any).user = decoded;

      next();
    } catch (err) {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
