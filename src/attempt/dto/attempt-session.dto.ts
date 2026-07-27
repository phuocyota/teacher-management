import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
} from 'class-validator';
import { AttemptStatus } from '../enum/attempt-status.enum';
import { QuestionType } from 'src/question/enum/question-type.enum';

export class StartAttemptDto {
  @IsUUID()
  @ApiProperty({
    description: 'ID question bank duoc dung de lam bai',
    example: '3233abe3-1961-4af5-a482-542f1227d844',
  })
  questionBankId!: string;

  @IsUUID()
  @IsOptional()
  @ApiProperty({
    description: 'ID bo de thi',
    example: '4233abe3-1961-4af5-a482-542f1227d844',
    required: false,
    nullable: true,
  })
  examSetId?: string | null;
}

export class StartPublicAttemptDto extends StartAttemptDto {
  @IsString()
  @Length(1, 150)
  @ApiProperty({
    description: 'Tên người làm bài từ bên ngoài hệ thống',
    example: 'Nguyễn Văn A',
  })
  guestName!: string;
}

export class EndAttemptAnswerDto {
  @IsUUID()
  @ApiProperty({
    description: 'ID cau hoi goc',
    example: '5233abe3-1961-4af5-a482-542f1227d844',
  })
  questionId!: string;

  @IsUUID()
  @IsOptional()
  @ApiProperty({
    description: 'ID dap an duoc chon cho cau hoi mot lua chon',
    example: '6233abe3-1961-4af5-a482-542f1227d844',
    required: false,
  })
  answerId?: string;

  @IsArray()
  @IsUUID(undefined, { each: true })
  @IsOptional()
  @ApiProperty({
    description: 'Danh sach dap an duoc chon cho cau hoi nhieu lua chon',
    example: [
      '7233abe3-1961-4af5-a482-542f1227d844',
      '8233abe3-1961-4af5-a482-542f1227d844',
    ],
    required: false,
  })
  selectedAnswerIds?: string[];

  @IsString()
  @IsOptional()
  @ApiProperty({
    description: 'Noi dung tu luan neu co',
    example: 'Cong dan so can bao ve thong tin ca nhan',
    required: false,
  })
  textValue?: string;

  @IsString()
  @IsOptional()
  @ApiProperty({
    description: 'Mo ta bo sung cho cau tra loi',
    example: 'Hoc sinh chon dap an theo tinh huong',
    required: false,
  })
  description?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  @ApiProperty({
    description: 'So giay lam cau hoi',
    example: 45,
    required: false,
  })
  timeSpentSec?: number;
}

export class EndAttemptDto {
  @IsArray()
  @ArrayMinSize(0)
  @ApiProperty({
    description:
      'Danh sach cau tra loi hoc sinh nop bai. Ho tro ca object day du lieu va format FE nhu ["1A", "2B"]',
    oneOf: [
      { type: 'array', items: { $ref: '#/components/schemas/EndAttemptAnswerDto' } },
      { type: 'array', items: { type: 'string', example: '1A' } },
    ],
    example: ['1A', '2B'],
  })
  answers!: Array<EndAttemptAnswerDto | string>;
}

export class AttemptAnswerChainItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  contentType!: string;

  @ApiProperty()
  content!: string;

  @ApiProperty({ required: false, nullable: true, type: Object })
  meta?: Record<string, unknown> | null;

  @ApiProperty({ required: false, nullable: true })
  nextContent?: string | null;
}

export class AttemptAnswerOptionDto extends AttemptAnswerChainItemDto {
  @ApiProperty({ type: [AttemptAnswerChainItemDto] })
  chain!: AttemptAnswerChainItemDto[];
}

export class AttemptQuestionChainItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: QuestionType })
  type!: QuestionType;

  @ApiProperty()
  contentType!: string;

  @ApiProperty()
  content!: string;

  @ApiProperty({ required: false, nullable: true, type: Object })
  meta?: Record<string, unknown> | null;

  @ApiProperty({ required: false, nullable: true })
  nextContent?: string | null;
}

export class AttemptQuestionItemDto extends AttemptQuestionChainItemDto {
  @ApiProperty()
  orderNo!: number;

  @ApiProperty()
  points!: number;

  @ApiProperty({ type: [AttemptQuestionChainItemDto] })
  chain!: AttemptQuestionChainItemDto[];

  @ApiProperty({ type: [AttemptAnswerOptionDto] })
  answers!: AttemptAnswerOptionDto[];
}

export class StartAttemptResponseDto {
  @ApiProperty()
  attemptId!: string;

  @ApiProperty({ enum: AttemptStatus })
  status!: AttemptStatus;

  @ApiProperty()
  startedAt!: Date;

  @ApiProperty({ required: false, nullable: true })
  studentId!: string | null;

  @ApiProperty({ required: false, nullable: true })
  guestName?: string | null;

  @ApiProperty()
  questionBankId!: string;

  @ApiProperty()
  questionBankName!: string;

  @ApiProperty({ required: false, nullable: true })
  examSetId?: string | null;

  @ApiProperty({ required: false, nullable: true })
  examSetName?: string | null;

  @ApiProperty()
  examName!: string;

  @ApiProperty({ type: [AttemptQuestionItemDto] })
  questions!: AttemptQuestionItemDto[];
}

export class EndAttemptResponseDto {
  @ApiProperty()
  attemptId!: string;

  @ApiProperty({ enum: AttemptStatus })
  status!: AttemptStatus;

  @ApiProperty()
  submittedAt!: Date;

  @ApiProperty({ required: false, nullable: true })
  score?: number | null;

  @ApiProperty()
  totalQuestions!: number;

  @ApiProperty()
  answeredQuestions!: number;
}

export class AttemptReviewAnswerOptionDto extends AttemptAnswerOptionDto {
  @ApiProperty()
  isCorrect!: boolean;

  @ApiProperty()
  isSelected!: boolean;
}

export class AttemptReviewQuestionItemDto extends AttemptQuestionItemDto {
  @ApiProperty({ required: false, nullable: true })
  studentAnswerId?: string | null;

  @ApiProperty({ required: false, nullable: true })
  answerId?: string | null;

  @ApiProperty({ type: [String] })
  selectedAnswerIds!: string[];

  @ApiProperty({ required: false, nullable: true })
  textValue?: string | null;

  @ApiProperty({ required: false, nullable: true })
  description?: string | null;

  @ApiProperty({ required: false, nullable: true })
  isCorrect?: boolean | null;

  @ApiProperty({ required: false, nullable: true })
  pointsEarned?: number | null;

  @ApiProperty({ required: false, nullable: true })
  timeSpentSec?: number | null;

  @ApiProperty({ type: [AttemptReviewAnswerOptionDto] })
  declare answers: AttemptReviewAnswerOptionDto[];
}

export class AttemptReviewResponseDto {
  @ApiProperty()
  attemptId!: string;

  @ApiProperty({ enum: AttemptStatus })
  status!: AttemptStatus;

  @ApiProperty()
  studentId!: string;

  @ApiProperty()
  questionBankId!: string;

  @ApiProperty({ required: false, nullable: true })
  examSetId?: string | null;

  @ApiProperty({ required: false, nullable: true })
  submittedAt?: Date | null;

  @ApiProperty({ required: false, nullable: true })
  score?: number | null;

  @ApiProperty()
  totalQuestions!: number;

  @ApiProperty()
  answeredQuestions!: number;

  @ApiProperty({ type: [AttemptReviewQuestionItemDto] })
  questions!: AttemptReviewQuestionItemDto[];
}
