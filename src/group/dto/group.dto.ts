import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsArray,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateGroupDto {
  @ApiProperty({
    description: 'Tên group',
    example: 'Giáo viên Toán',
  })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({
    description: 'Danh sách user IDs để thêm vào group',
    example: ['user-id-1', 'user-id-2'],
    type: [String],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  userIds?: string[];
}

export class UpdateGroupDto extends PartialType(CreateGroupDto) {}

export class AddUsersToGroupDto {
  @ApiProperty({
    description: 'Danh sách user IDs để thêm vào group',
    example: ['user-id-1', 'user-id-2'],
    type: [String],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  userIds: string[];
}

export class RemoveUsersFromGroupDto {
  @ApiProperty({
    description: 'Danh sách user IDs để xóa khỏi group',
    example: ['user-id-1', 'user-id-2'],
    type: [String],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  userIds: string[];
}

/**
 * DTO response cho Group
 */
export class GroupResponseDto {
  @ApiProperty({ description: 'ID của group' })
  id: string;

  @ApiProperty({ description: 'Mã group (tự động tăng)', example: 1 })
  code: number;

  @ApiProperty({ description: 'Tên group', example: 'Giáo viên Toán' })
  name: string;

  @ApiProperty({ description: 'Ngày tạo' })
  createdAt: Date;

  @ApiPropertyOptional({ description: 'Ngày cập nhật' })
  updatedAt?: Date;
}

/**
 * DTO response cho Group với số lượng members
 */
export class GroupWithMemberCountDto extends GroupResponseDto {
  @ApiProperty({ description: 'Số lượng thành viên', example: 5 })
  memberCount: number;
}

/**
 * DTO cho thành viên trong group
 */
export class GroupMemberDto {
  @ApiProperty({ description: 'ID của user' })
  id: string;

  @ApiProperty({ description: 'Tên đăng nhập', example: 'john_doe' })
  userName: string;

  @ApiPropertyOptional({
    description: 'Họ tên đầy đủ',
    example: 'Nguyễn Văn A',
  })
  fullName?: string;

  @ApiProperty({ description: 'Email', example: 'nguyenvana@school.edu.vn' })
  email: string;
}

/**
 * DTO response cho Group với danh sách members
 */
export class GroupWithMembersDto extends GroupResponseDto {
  @ApiProperty({
    description: 'Danh sách thành viên',
    type: [GroupMemberDto],
  })
  members: GroupMemberDto[];
}

/**
 * DTO response cho mã group lớn nhất
 */
export class MaxCodeResponseDto {
  @ApiProperty({ description: 'Mã group lớn nhất hiện tại', example: 10 })
  maxCode: number;
}
