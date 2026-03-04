import { ApiProperty } from '@nestjs/swagger';
import { BaseDto } from 'src/common/dto/base.dto';
import { PaginationResponseDto } from 'src/common/dto/pagination.dto';

export class ExamSetQuestionBankResponseDto extends BaseDto {
  @ApiProperty({
    description: 'ID bo de thi',
    example: '2233abe3-1961-4af5-a482-542f1227d844',
  })
  examSetId!: string;

  @ApiProperty({
    description: 'ID ngan hang cau hoi',
    example: 'a6fd0f8e-b2bf-4fe8-8be1-1062f27822da',
  })
  questionBankId!: string;

  @ApiProperty({
    description: 'Thu tu sap xep',
    example: 1,
  })
  order!: number;
}

export class ExamSetQuestionBankListResponseDto extends PaginationResponseDto<ExamSetQuestionBankResponseDto> {
  @ApiProperty({
    description: 'Danh sach lien ket bo de thi - ngan hang cau hoi',
    type: [ExamSetQuestionBankResponseDto],
  })
  declare data: ExamSetQuestionBankResponseDto[];
}
