import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';

export class CreateGradeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @ApiProperty({
    description: 'Mã Khối (code)',
    example: 'GR-10',
  })
  code!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @ApiProperty({
    description: 'Tên Khối',
    example: 'Khối 10',
  })
  name!: string;
}

export class UpdateGradeDto extends PartialType(CreateGradeDto) {}
