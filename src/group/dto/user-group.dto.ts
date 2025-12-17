import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsEnum } from 'class-validator';
import { GroupMemberRole } from '../enum/group-member-role.enum';

/**
 * DTO cho UserGroupEntity
 */
export class UserGroupDto {
  @ApiProperty({
    description: 'Group ID',
    example: 'group-uuid',
  })
  @IsUUID('4')
  groupId: string;

  @ApiProperty({
    description: 'User ID',
    example: 'user-uuid',
  })
  @IsUUID('4')
  userId: string;

  @ApiProperty({
    description: 'Vai trò của user trong group',
    enum: GroupMemberRole,
  })
  @IsEnum(GroupMemberRole)
  role: GroupMemberRole;

  @ApiPropertyOptional({
    description: 'Ngày tạo',
  })
  createdAt?: Date;

  @ApiPropertyOptional({
    description: 'Ngày cập nhật',
  })
  updatedAt?: Date;
}

/**
 * DTO cho thông tin user trong UserGroup
 */
export class UserGroupUserDto {
  @ApiProperty({
    description: 'User ID',
  })
  id: string;

  @ApiProperty({
    description: 'Tên đăng nhập',
  })
  userName: string;

  @ApiPropertyOptional({
    description: 'Họ tên đầy đủ',
  })
  fullName?: string;

  @ApiProperty({
    description: 'Email',
  })
  email: string;
}

/**
 * DTO cho thông tin group trong UserGroup
 */
export class UserGroupGroupDto {
  @ApiProperty({
    description: 'Group ID',
  })
  id: string;

  @ApiProperty({
    description: 'Mã group',
  })
  code: number;

  @ApiProperty({
    description: 'Tên group',
  })
  name: string;
}

/**
 * DTO response chi tiết UserGroupEntity với user info
 */
export class UserGroupDetailDto extends UserGroupDto {
  @ApiProperty({
    description: 'Thông tin user',
    type: UserGroupUserDto,
  })
  user?: UserGroupUserDto;

  @ApiProperty({
    description: 'Thông tin group',
    type: UserGroupGroupDto,
  })
  group?: UserGroupGroupDto;
}

/**
 * DTO response cho user với danh sách groups
 */
export class UserWithGroupsDto {
  @ApiProperty({
    description: 'User ID',
  })
  id: string;

  @ApiProperty({
    description: 'Tên đăng nhập',
  })
  userName: string;

  @ApiPropertyOptional({
    description: 'Họ tên đầy đủ',
  })
  fullName?: string;

  @ApiProperty({
    description: 'Email',
  })
  email: string;

  @ApiProperty({
    description: 'Danh sách groups của user',
    type: Array,
  })
  groups: Array<{
    id: string;
    code: number;
    name: string;
    role: GroupMemberRole;
  }>;
}

/**
 * DTO cho group item trong danh sách của user
 */
export class UserGroupItemDto {
  @ApiProperty({
    description: 'Group ID',
  })
  id: string;

  @ApiProperty({
    description: 'Mã group',
  })
  code: number;

  @ApiProperty({
    description: 'Tên group',
  })
  name: string;

  @ApiProperty({
    description: 'Vai trò của user trong group',
    enum: GroupMemberRole,
  })
  role: GroupMemberRole;
}

/**
 * DTO response cho check membership
 */
export class CheckMembershipDto {
  @ApiProperty({
    description: 'User có trong group hay không',
    example: true,
  })
  isMember: boolean;

  @ApiPropertyOptional({
    description: 'Vai trò của user trong group',
    enum: GroupMemberRole,
  })
  role?: GroupMemberRole;
}
