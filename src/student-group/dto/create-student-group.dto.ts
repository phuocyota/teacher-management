import { IsString, IsNotEmpty, IsNumber, IsUUID } from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';

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

  @IsUUID()
  @IsNotEmpty()
  @ApiProperty({
    description: 'ID của trường học',
    example: '2233abe3-1961-4af5-a482-542f1227d844',
  })
  schoolId!: string;
}

export class UpdateStudentGroupDto extends PartialType(CreateStudentGroupDto) {}
