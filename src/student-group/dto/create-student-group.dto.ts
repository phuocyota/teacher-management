import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsUUID,
  IsEnum,
  IsOptional,
} from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';
import { GroupMemberRole } from 'src/user-group/enum/group-member-role.enum';

export class CreateStudentGroupDto {
  @IsNumber()
  @IsNotEmpty()
  @ApiProperty({
    description: 'Mã nhóm học sinh',
    example: 1,
  })
  code!: number;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    description: 'Tên nhóm học sinh',
    example: 'Nhóm A1',
  })
  name!: string;

  @IsEnum(GroupMemberRole)
  @IsOptional()
  @ApiProperty({
    description: 'Vai trò của nhóm học sinh',
    enum: GroupMemberRole,
    example: GroupMemberRole.MEMBER,
    default: GroupMemberRole.MEMBER,
    required: false,
  })
  role?: GroupMemberRole;

  @IsUUID()
  @IsNotEmpty()
  @ApiProperty({
    description: 'ID của trường học',
    example: '2233abe3-1961-4af5-a482-542f1227d844',
  })
  schoolId!: string;
}

export class UpdateStudentGroupDto extends PartialType(CreateStudentGroupDto) {}
