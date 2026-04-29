import { IsString, IsNotEmpty, IsUUID, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class CreateStudentDto {
  @IsOptional()
  @IsUUID()
  @ApiPropertyOptional({
    description: 'ID cua nhom hoc sinh',
    example: '3344abe3-1961-4af5-a482-542f1227d855',
    nullable: true,
  })
  studentGroupId?: string;

  @IsOptional()
  @IsUUID()
  @ApiPropertyOptional({
    description: 'ID cua truong hoc',
    example: '2233abe3-1961-4af5-a482-542f1227d844',
    nullable: true,
  })
  schoolId?: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    description: 'Ma hoc sinh',
    example: 'HS001',
  })
  code!: string;
}

export class UpdateStudentDto extends PartialType(CreateStudentDto) {}
