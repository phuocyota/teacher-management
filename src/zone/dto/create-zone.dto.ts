import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';

export class CreateZoneDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @ApiProperty({
    description: 'Ma khu vuc',
    example: 'ZONE-001',
  })
  code!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @ApiProperty({
    description: 'Ten khu vuc',
    example: 'Khu vuc 1',
  })
  name!: string;
}

export class UpdateZoneDto extends PartialType(CreateZoneDto) {}
