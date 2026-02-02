import { IsString, IsNotEmpty, IsUUID } from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';

export class CreateStudentDto {
  @IsUUID()
  @IsNotEmpty()
  @ApiProperty({
    description: 'ID của người dùng (học sinh)',
    example: '2233abe3-1961-4af5-a482-542f1227d844',
  })
  userId!: string;

  @IsUUID()
  @IsNotEmpty()
  @ApiProperty({
    description: 'ID của nhóm học sinh',
    example: '3344abe3-1961-4af5-a482-542f1227d855',
  })
  studentGroupId!: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    description: 'Mã học sinh',
    example: 'HS001',
  })
  code!: string;
}

export class UpdateStudentDto extends PartialType(CreateStudentDto) {}
