import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'john_doe',
    description: 'Tên đăng nhập hoặc email của người dùng',
  })
  @IsNotEmpty()
  @IsString()
  username: string; // username or email

  @ApiProperty({
    example: 'Password@123',
    description: 'Mật khẩu của người dùng',
  })
  @IsNotEmpty()
  @IsString()
  password: string;

  @ApiProperty({
    example: 'device-12345',
    description: 'ID thiết bị đăng nhập',
  })
  @IsNotEmpty()
  @IsString()
  deviceId: string; // required by existing middleware/token structure
}
