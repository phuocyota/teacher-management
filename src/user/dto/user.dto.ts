import { IsEmail, IsNotEmpty, IsOptional } from 'class-validator';
import { UserType } from 'src/common/enum/user-type.enum';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({
    example: 'john_doe',
    description: 'Tên đăng nhập của người dùng',
  })
  @IsNotEmpty()
  userName!: string;

  @ApiProperty({
    example: 'John Doe',
    description: 'Tên đầy đủ của người dùng',
  })
  @IsOptional()
  fullName?: string;

  @ApiProperty({
    example: 'strongPassword123',
    description: 'Mật khẩu của người dùng',
  })
  @IsNotEmpty()
  password!: string;

  @ApiProperty({
    example: 'john.doe@example.com',
    description: 'Email của người dùng',
  })
  @IsNotEmpty()
  @IsEmail()
  email!: string;

  @ApiProperty({
    example: '0901234567',
    description: 'Số điện thoại của người dùng',
    required: false,
  })
  @IsOptional()
  phoneNumber?: string;

  @ApiProperty({
    example: 'ADMIN',
    description: 'Loại người dùng (ADMIN hoặc TEACHER)',
  })
  @IsNotEmpty()
  userType!: UserType;
}

export class UpdateUserDto {
  @ApiProperty({
    example: 'John Doe',
    description: 'Tên đầy đủ của người dùng',
  })
  @IsOptional()
  fullName?: string;

  @ApiProperty({
    example: 'john.doe@example.com',
    description: 'Email của người dùng',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({
    example: '0901234567',
    description: 'Số điện thoại của người dùng',
  })
  @IsOptional()
  phoneNumber?: string;
}
