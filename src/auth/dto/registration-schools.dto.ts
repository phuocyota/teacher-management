import { ApiProperty } from '@nestjs/swagger';

class RegistrationOptionDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;
}

class RegistrationSchoolDto extends RegistrationOptionDto {
  @ApiProperty({ type: [RegistrationOptionDto] })
  classes!: RegistrationOptionDto[];
}

class RegistrationZoneDto extends RegistrationOptionDto {
  @ApiProperty({ example: 'HCM' })
  code!: string;
}

export class RegistrationSchoolsDto {
  @ApiProperty({ type: RegistrationZoneDto })
  zone!: RegistrationZoneDto;

  @ApiProperty({ type: [RegistrationSchoolDto] })
  schools!: RegistrationSchoolDto[];
}
