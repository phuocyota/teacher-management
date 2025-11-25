import { IsString, IsOptional, IsBoolean, Length } from 'class-validator';

export class CreateLicenseDto {
  @IsString()
  @Length(1, 100)
  key: string;

  @IsOptional()
  @IsString()
  activationDate?: string;

  @IsOptional()
  @IsBoolean()
  expirationDate?: boolean;

  @IsString()
  userId: string;
}

export class UpdateLicenseDto {
  @IsString()
  @Length(1, 100)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
