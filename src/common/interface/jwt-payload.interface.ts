import { UserType } from '../enum/user-type.enum';

export interface JwtPayload {
  userId: string;
  userType: UserType;
  deviceId: string;
  iat?: number;
  exp?: number;
}
