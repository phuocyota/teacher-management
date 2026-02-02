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
    // Validate studentGroupId exists
    const studentGroup = await this.studentGroupService.findOne(
      dto.studentGroupId,
    );

    // Kiểm tra trùng code
    const existingStudent = await this.studentRepo.findOne({
      where: { code: dto.code },
    });

    if (existingStudent) {
      throw new ConflictException('Mã học sinh đã tồn tại');
    }

    // Kiểm tra userId đã được gán cho student khác chưa
    const existingUser = await this.studentRepo.findOne({
      where: { userId: dto.userId },
    });

    if (existingUser) {
      throw new ConflictException(
        'Người dùng này đã được gán cho học sinh khác',
      );
    }

    const record = this.studentRepo.create({
      userId: dto.userId,
      code: dto.code,
      studentGroup: studentGroup,
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
      qb.andWhere('student.student_group_id = :studentGroupId', {
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
          ENTITY_NAMES.STUDENT ?? 'Học sinh',
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
    }

    if (dto.code !== undefined && dto.code !== record.code) {
      const existingStudent = await this.studentRepo.findOne({
        where: { code: dto.code },
      });

      if (existingStudent) {
        throw new ConflictException('Mã học sinh đã tồn tại');
      }
      record.code = dto.code;
    }

    if (dto.userId !== undefined && dto.userId !== record.userId) {
      const existingUser = await this.studentRepo.findOne({
        where: { userId: dto.userId },
      });

      if (existingUser) {
        throw new ConflictException(
          'Người dùng này đã được gán cho học sinh khác',
        );
      }
      record.userId = dto.userId;
    }

    return this.studentRepo.save(record);
  }

  async remove(id: string): Promise<void> {
    const record = await this.findOne(id);
    await this.studentRepo.remove(record);
  }
}
