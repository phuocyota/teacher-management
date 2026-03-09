import { IsString, IsNotEmpty, IsUUID } from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';

export class CreateStudentDto {
  @IsUUID()
  @IsNotEmpty()
  @ApiProperty({
    description: 'ID cua nhom hoc sinh',
    example: '3344abe3-1961-4af5-a482-542f1227d855',
  })
  studentGroupId!: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    description: 'Ma hoc sinh',
    example: 'HS001',
  })
  code!: string;
}

export class UpdateStudentDto extends PartialType(CreateStudentDto) {}
