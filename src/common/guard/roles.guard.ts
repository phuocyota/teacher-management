import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorator/roles.decorator';
import { isAdminUserType, UserType } from '../enum/user-type.enum';

interface RequestWithUser extends Request {
  user?: {
    userType: string;
  };
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    const hasRequiredRole =
      !!user &&
      (requiredRoles.includes(user.userType) ||
        (requiredRoles.includes(UserType.ADMIN) &&
          isAdminUserType(user.userType as UserType)));

    if (!hasRequiredRole) {
      throw new ForbiddenException('Bạn không có quyền');
    }

    return true;
  }
}
