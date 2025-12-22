import { SetMetadata } from '@nestjs/common';
import { UserType } from '../../common/enum/user-type.enum.js';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserType[]) => SetMetadata(ROLES_KEY, roles);
