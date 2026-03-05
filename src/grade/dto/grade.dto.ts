import { ApiProperty } from '@nestjs/swagger';
import { BaseDto } from 'src/common/dto/base.dto';
import { PaginationResponseDto } from 'src/common/dto/pagination.dto';

export class GradeResponseDto extends BaseDto {
  @ApiProperty({
    description: 'Ma Khoi (code)',
    example: 'GR-10',
  })
  code!: string;

  @ApiProperty({
    description: 'Ten Khoi',
    example: 'Khoi 10',
  })
  name!: string;
}

export class GradeListResponseDto extends PaginationResponseDto<GradeResponseDto> {
  @ApiProperty({
    description: 'Danh sach Khoi',
    type: [GradeResponseDto],
  })
  declare data: GradeResponseDto[];
}

export class GradeDetailInfoDto {
  @ApiProperty({
    description: 'ID khoi',
    example: '2233abe3-1961-4af5-a482-542f1227d844',
  })
  id!: string;

  @ApiProperty({
    description: 'Ten khoi',
    example: 'Khoi 1',
  })
  name!: string;
}

export class GradeDetailExamSetDto {
  @ApiProperty({
    description: 'ID bo de thi',
    example: '2233abe3-1961-4af5-a482-542f1227d844',
  })
  id!: string;

  @ApiProperty({
    description: 'Tieu de bo de thi',
    example: 'Kiem tra giua ki 1',
  })
  title!: string;

  @ApiProperty({
    description: 'Hinh anh bo de thi',
    example: 'https://example.com/exam-set-image.jpg',
    required: false,
  })
  image?: string;
}

export class GradeDetailSubjectDto {
  @ApiProperty({
    description: 'ID mon hoc',
    example: 'a6fd0f8e-b2bf-4fe8-8be1-1062f27822da',
  })
  id!: string;

  @ApiProperty({
    description: 'Ten mon hoc',
    example: 'Cong dan so',
  })
  name!: string;

  @ApiProperty({
    description: 'Danh sach bo de thi',
    type: [GradeDetailExamSetDto],
  })
  examSets!: GradeDetailExamSetDto[];

  @ApiProperty({
    description: 'Tong so bo de thi cua mon hoc',
    example: 4,
  })
  total!: number;
}

export class GradeDetailResponseDto {
  @ApiProperty({
    description: 'Thong tin khoi',
    type: GradeDetailInfoDto,
  })
  grade!: GradeDetailInfoDto;

  @ApiProperty({
    description: 'Danh sach mon hoc trong khoi',
    type: [GradeDetailSubjectDto],
  })
  subjects!: GradeDetailSubjectDto[];
}

export class GradeDetailListResponseDto extends PaginationResponseDto<GradeDetailResponseDto> {
  @ApiProperty({
    description: 'Danh sach khoi kem chi tiet mon hoc va bo de thi',
    type: [GradeDetailResponseDto],
  })
  declare data: GradeDetailResponseDto[];
}
