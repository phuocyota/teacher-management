import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtPayload } from '../interface/jwt-payload.interface';

export const User = createParamDecorator(
  (data: keyof JwtPayload, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user?: JwtPayload }>();
    const user = request.user;

    if (!user) return null;

    return data ? user[data] : user;
  },
);
