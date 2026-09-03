import bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { UserType } from 'src/common/enum/user-type.enum';
import { UserEntity } from 'src/user/user.entity';

describe('AuthService', () => {
  const password = 'Password@123';
  let authService: AuthService;
  let userService: {
    findByUsernameOrEmail: jest.Mock;
  };

  beforeEach(() => {
    userService = {
      findByUsernameOrEmail: jest.fn(),
    };

    authService = new AuthService(userService as never, {} as never);
  });

  it.each(['teacher01', 'teacher@example.com'])(
    'accepts %s from the username field',
    async (identifier) => {
      const user = {
        userName: 'teacher01',
        email: 'teacher@example.com',
        hashPassword: await bcrypt.hash(password, 4),
        userType: UserType.TEACHER,
      } as UserEntity;
      userService.findByUsernameOrEmail.mockResolvedValue(user);

      await expect(authService.validateUser(identifier, password)).resolves.toBe(
        user,
      );
      expect(userService.findByUsernameOrEmail).toHaveBeenCalledWith(identifier);
    },
  );
});
