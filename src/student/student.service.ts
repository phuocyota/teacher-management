import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StudentEntity } from './student.entity';
import { CreateStudentDto, UpdateStudentDto } from './dto/create-student.dto';
import { StudentGroupService } from 'src/student-group/student-group.service';
import {
  ERROR_MESSAGES,
  ENTITY_NAMES,
} from 'src/common/constant/error-messages.constant';
import { PaginationResponseDto } from 'src/common/dto/pagination.dto';
import { StudentResponseDto } from './dto/student.dto';
import { autoMapListToDto } from 'src/common/utils/auto-map.util';

@Injectable()
export class StudentService {
  constructor(
    @InjectRepository(StudentEntity)
    private readonly studentRepo: Repository<StudentEntity>,
    private readonly studentGroupService: StudentGroupService,
  ) {}

  async create(dto: CreateStudentDto): Promise<StudentEntity> {
    const studentGroup = await this.studentGroupService.findOne(
      dto.studentGroupId,
    );

    const existingStudent = await this.studentRepo.findOne({
      where: { code: dto.code },
    });

    if (existingStudent) {
      throw new ConflictException('Ma hoc sinh da ton tai');
    }

    const record = this.studentRepo.create({
      studentGroupId: dto.studentGroupId,
      code: dto.code,
      studentGroup,
    });
    return this.studentRepo.save(record);
  }

  async findAll(
    page = 1,
    size = 10,
    studentGroupId?: string,
    search?: string,
  ): Promise<PaginationResponseDto<StudentResponseDto>> {
    const skip = (page - 1) * size;

    const qb = this.studentRepo
      .createQueryBuilder('student')
      .leftJoinAndSelect('student.studentGroup', 'studentGroup')
      .leftJoinAndSelect('studentGroup.school', 'school');

    if (studentGroupId) {
      qb.andWhere('student.studentGroupId = :studentGroupId', {
        studentGroupId,
      });
    }

    if (search) {
      qb.andWhere('student.code ILIKE :search', { search: `%${search}%` });
    }

    qb.orderBy('student.createdAt', 'DESC');
    qb.skip(skip).take(size);

    const [data, total] = await qb.getManyAndCount();

    return {
      data: autoMapListToDto(StudentResponseDto, data),
      page,
      size,
      total,
    };
  }

  async findOne(id: string): Promise<StudentEntity> {
    const record = await this.studentRepo.findOne({
      where: { id },
      relations: ['studentGroup', 'studentGroup.school'],
    });

    if (!record) {
      throw new NotFoundException(
        ERROR_MESSAGES.NOT_FOUND_WITH_ID(
          ENTITY_NAMES.STUDENT ?? 'Hoc sinh',
          id,
        ),
      );
    }

    return record;
  }

  async update(id: string, dto: UpdateStudentDto): Promise<StudentEntity> {
    const record = await this.findOne(id);

    if (dto.studentGroupId) {
      const studentGroup = await this.studentGroupService.findOne(
        dto.studentGroupId,
      );
      record.studentGroup = studentGroup;
      record.studentGroupId = dto.studentGroupId;
    }

    if (dto.code !== undefined && dto.code !== record.code) {
      const existingStudent = await this.studentRepo.findOne({
        where: { code: dto.code },
      });

      if (existingStudent) {
        throw new ConflictException('Ma hoc sinh da ton tai');
      }
      record.code = dto.code;
    }

    return this.studentRepo.save(record);
  }

  async remove(id: string): Promise<void> {
    const record = await this.findOne(id);
    await this.studentRepo.remove(record);
  }
}
