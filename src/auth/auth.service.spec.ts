import { UnauthorizedException } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { UserType } from 'src/common/enum/user-type.enum';

const mockUser = {
  id: 'u1',
  userType: UserType.ADMIN,
  hashPassword: 'hash',
};

describe('AuthService', () => {
  let service: AuthService;
  let userService: { findByUsernameOrEmail: jest.Mock; createUser: jest.Mock };

  beforeEach(() => {
    userService = {
      findByUsernameOrEmail: jest.fn(),
      createUser: jest.fn(),
    };
    service = new AuthService(userService as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('validateUser returns null when user not found', async () => {
    userService.findByUsernameOrEmail.mockResolvedValue(null);

    const result = await service.validateUser('user', 'pass');

    expect(result).toBeNull();
  });

  it('validateUser returns null when password mismatch', async () => {
    userService.findByUsernameOrEmail.mockResolvedValue(mockUser);
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as any);

    const result = await service.validateUser('user', 'pass');

    expect(result).toBeNull();
  });

  it('validateUser returns user when password matches', async () => {
    userService.findByUsernameOrEmail.mockResolvedValue(mockUser);
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as any);

    const result = await service.validateUser('user', 'pass');

    expect(result).toBe(mockUser);
  });

  it('login returns token payload on success', async () => {
    jest.spyOn(service, 'validateUser').mockResolvedValue(mockUser as any);

    const result = await service.login({
      username: 'user',
      password: 'pass',
      deviceId: 'd1',
    } as any);

    expect(result.userId).toBe('u1');
    expect(result.userType).toBe(UserType.ADMIN);
    expect(result.deviceId).toBe('d1');
    expect(typeof result.accessToken).toBe('string');
  });

  it('login throws when invalid', async () => {
    jest.spyOn(service, 'validateUser').mockResolvedValue(null);

    await expect(
      service.login({ username: 'u', password: 'p', deviceId: 'd' } as any),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('loginAdmin rejects non-admin user', async () => {
    jest
      .spyOn(service, 'validateUser')
      .mockResolvedValue({ ...mockUser, userType: UserType.TEACHER } as any);

    await expect(
      service.loginAdmin({ username: 'u', password: 'p', deviceId: 'd' } as any),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('loginTeacher rejects non-teacher user', async () => {
    jest
      .spyOn(service, 'validateUser')
      .mockResolvedValue({ ...mockUser, userType: UserType.ADMIN } as any);

    await expect(
      service.loginTeacher({
        username: 'u',
        password: 'p',
        deviceId: 'd',
      } as any),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('register delegates to userService.createUser', async () => {
    userService.createUser.mockResolvedValue({ id: 'u1' });

    const result = await service.register({ userName: 'u' } as any);

    expect(userService.createUser).toHaveBeenCalledWith({ userName: 'u' });
    expect(result).toEqual({ id: 'u1' });
  });
});
