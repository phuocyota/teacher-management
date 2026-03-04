import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';

export class CreateSubjectDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @ApiProperty({
    description: 'Ma mon hoc (code)',
    example: 'SUB-001',
  })
  code!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @ApiProperty({
    description: 'Ten mon hoc',
    example: 'Toan',
  })
  name!: string;
}

export class UpdateSubjectDto extends PartialType(CreateSubjectDto) {}
