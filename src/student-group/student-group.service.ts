import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StudentGroupEntity } from './student-group.entity';
import {
  CreateStudentGroupDto,
  UpdateStudentGroupDto,
} from './dto/create-student-group.dto';
import { SchoolService } from 'src/school/school.service';
import {
  ERROR_MESSAGES,
  ENTITY_NAMES,
} from 'src/common/constant/error-messages.constant';
import { PaginationResponseDto } from 'src/common/dto/pagination.dto';
import { StudentGroupResponseDto } from './dto/student-group.dto';
import { autoMapListToDto } from 'src/common/utils/auto-map.util';

@Injectable()
export class StudentGroupService {
  constructor(
    @InjectRepository(StudentGroupEntity)
    private readonly studentGroupRepo: Repository<StudentGroupEntity>,
    private readonly schoolService: SchoolService,
  ) {}

  async create(dto: CreateStudentGroupDto): Promise<StudentGroupEntity> {
    // Validate schoolId exists
    const school = await this.schoolService.findOne(dto.schoolId);

    // Kiểm tra trùng code trong cùng trường
    const existingGroup = await this.studentGroupRepo.findOne({
      where: {
        code: dto.code,
        schoolId: dto.schoolId,
      },
    });

    if (existingGroup) {
      throw new ConflictException(
        'Mã nhóm học sinh đã tồn tại trong trường này',
      );
    }

    const record = this.studentGroupRepo.create({
      code: dto.code,
      name: dto.name,
      school: school,
    });
    return this.studentGroupRepo.save(record);
  }

  async findAll(
    page = 1,
    size = 10,
    schoolId?: string,
    search?: string,
  ): Promise<PaginationResponseDto<StudentGroupResponseDto>> {
    const skip = (page - 1) * size;

    const qb = this.studentGroupRepo
      .createQueryBuilder('sg')
      .leftJoinAndSelect('sg.school', 'school');

    if (schoolId) {
      qb.andWhere('sg.school_id = :schoolId', { schoolId });
    }

    if (search) {
      qb.andWhere('sg.name ILIKE :search', { search: `%${search}%` });
    }

    qb.orderBy('sg.createdAt', 'DESC');
    qb.skip(skip).take(size);

    const [data, total] = await qb.getManyAndCount();

    return {
      data: autoMapListToDto(StudentGroupResponseDto, data),
      page,
      size,
      total,
    };
  }

  async findOne(id: string): Promise<StudentGroupEntity> {
    const record = await this.studentGroupRepo.findOne({
      where: { id },
      relations: ['school'],
    });

    if (!record) {
      throw new NotFoundException(
        ERROR_MESSAGES.NOT_FOUND_WITH_ID(
          ENTITY_NAMES.STUDENT_GROUP ?? 'Nhóm học sinh',
          id,
        ),
      );
    }

    return record;
  }

  async update(
    id: string,
    dto: UpdateStudentGroupDto,
  ): Promise<StudentGroupEntity> {
    const record = await this.findOne(id);

    if (dto.schoolId) {
      const school = await this.schoolService.findOne(dto.schoolId);
      record.school = school;
    }

    if (dto.code !== undefined || dto.schoolId) {
      const code = dto.code ?? record.code;
      const schoolId = dto.schoolId ?? record.schoolId;

      if (code !== record.code || schoolId !== record.schoolId) {
        const existingGroup = await this.studentGroupRepo.findOne({
          where: { code, schoolId },
        });

        if (existingGroup && existingGroup.id !== id) {
          throw new ConflictException(
            'Mã nhóm học sinh đã tồn tại trong trường này',
          );
        }
      }

      if (dto.code !== undefined) {
        record.code = dto.code;
      }
    }

    if (dto.name !== undefined) {
      record.name = dto.name;
    }

    return this.studentGroupRepo.save(record);
  }

  async remove(id: string): Promise<void> {
    const record = await this.findOne(id);
    await this.studentGroupRepo.remove(record);
  }
}
