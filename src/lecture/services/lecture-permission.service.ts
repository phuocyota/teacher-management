import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { TeacherLecturePermissionEntity } from '../entity/teacher-lecture-permission.entity';
import { LectureEntity } from '../entity/lecture.entity';
import { UserEntity } from 'src/user/user.entity';
import {
  GrantLecturePermissionDto,
  GrantMultipleLecturePermissionsDto,
  TeacherLecturePermissionResponseDto,
} from '../dto/lecture-permission.dto';
import { JwtPayload } from 'src/common/interface/jwt-payload.interface';
import { UserType } from 'src/common/enum/user-type.enum';
import { ERROR_MESSAGES } from 'src/common/constant/error-messages.constant';

@Injectable()
export class LecturePermissionService {
  constructor(
    @InjectRepository(TeacherLecturePermissionEntity)
    private readonly permissionRepo: Repository<TeacherLecturePermissionEntity>,
    @InjectRepository(LectureEntity)
    private readonly lectureRepo: Repository<LectureEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  /**
   * Chuyển đổi Entity sang DTO
   */
  private toResponseDto(
    entity: TeacherLecturePermissionEntity,
  ): TeacherLecturePermissionResponseDto {
    return {
      id: entity.id,
      lectureId: entity.lectureId,
      teacherId: entity.teacherId,
      permissionType: entity.permissionType,
      grantedBy: entity.grantedBy,
      expiresAt: entity.expiresAt,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  /**
   * Cấp quyền cho giáo viên xem bài giảng
   */
  async grantPermission(
    dto: GrantLecturePermissionDto,
    user: JwtPayload,
  ): Promise<TeacherLecturePermissionResponseDto> {
    // Kiểm tra quyền - chỉ admin
    if (user.userType !== UserType.ADMIN) {
      throw new ForbiddenException(
        'Chỉ admin mới có thể cấp quyền xem bài giảng',
      );
    }

    // Kiểm tra bài giảng tồn tại
    const lecture = await this.lectureRepo.findOne({
      where: { id: dto.lectureId },
    });
    if (!lecture) {
      throw new NotFoundException(
        ERROR_MESSAGES.NOT_FOUND_WITH_ID('Bài giảng', dto.lectureId),
      );
    }

    // Kiểm tra giáo viên tồn tại
    const teacher = await this.userRepo.findOne({
      where: { id: dto.teacherId },
    });
    if (!teacher) {
      throw new NotFoundException(
        ERROR_MESSAGES.NOT_FOUND_WITH_ID('Giáo viên', dto.teacherId),
      );
    }

    // Kiểm tra quyền đã tồn tại
    const existing = await this.permissionRepo.findOne({
      where: {
        lectureId: dto.lectureId,
        teacherId: dto.teacherId,
      },
    });
    if (existing) {
      // Cập nhật quyền nếu đã tồn tại
      existing.permissionType = dto.permissionType;
      existing.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : undefined;
      const updated = await this.permissionRepo.save(existing);
      return this.toResponseDto(updated);
    }

    // Tạo quyền mới
    const permission = this.permissionRepo.create({
      lectureId: dto.lectureId,
      teacherId: dto.teacherId,
      permissionType: dto.permissionType,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      grantedBy: user.userId,
    });

    const saved = await this.permissionRepo.save(permission);
    return this.toResponseDto(saved);
  }

  /**
   * Cấp quyền cho nhiều giáo viên
   * Sử dụng transaction để đảm bảo tính nhất quán
   */
  async grantPermissionsToMultiple(
    dto: GrantMultipleLecturePermissionsDto,
    user: JwtPayload,
  ): Promise<TeacherLecturePermissionResponseDto[]> {
    // Kiểm tra quyền - chỉ admin
    if (user.userType !== UserType.ADMIN) {
      throw new ForbiddenException(
        'Chỉ admin mới có thể cấp quyền xem bài giảng',
      );
    }

    // Kiểm tra bài giảng tồn tại
    const lecture = await this.lectureRepo.findOne({
      where: { id: dto.lectureId },
    });
    if (!lecture) {
      throw new NotFoundException(
        ERROR_MESSAGES.NOT_FOUND_WITH_ID('Bài giảng', dto.lectureId),
      );
    }

    // Kiểm tra tất cả giáo viên tồn tại
    const teachers = await this.userRepo.find({
      where: { id: In(dto.teacherIds) },
    });
    if (teachers.length !== dto.teacherIds.length) {
      throw new BadRequestException('Một số giáo viên không tồn tại');
    }

    // Sử dụng transaction để cấp quyền cho tất cả giáo viên
    return this.permissionRepo.manager.connection.transaction(
      async (manager) => {
        const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : undefined;
        const results: TeacherLecturePermissionResponseDto[] = [];

        for (const teacherId of dto.teacherIds) {
          const existing = await manager.findOne(
            TeacherLecturePermissionEntity,
            {
              where: {
                lectureId: dto.lectureId,
                teacherId,
              },
            },
          );

          let permission: TeacherLecturePermissionEntity;
          if (existing) {
            existing.permissionType = dto.permissionType;
            existing.expiresAt = expiresAt;
            permission = await manager.save(existing);
          } else {
            const newPermission = this.permissionRepo.create({
              lectureId: dto.lectureId,
              teacherId,
              permissionType: dto.permissionType,
              expiresAt,
              grantedBy: user.userId,
            });
            permission = await manager.save(newPermission);
          }

          results.push(this.toResponseDto(permission));
        }

        return results;
      },
    );
  }

  /**
   * Xóa quyền
   */
  async revokePermission(
    lectureId: string,
    teacherId: string,
    user: JwtPayload,
  ): Promise<void> {
    // Kiểm tra quyền - chỉ admin
    if (user.userType !== UserType.ADMIN) {
      throw new ForbiddenException(
        'Chỉ admin mới có thể thu hồi quyền xem bài giảng',
      );
    }

    const permission = await this.permissionRepo.findOne({
      where: {
        lectureId,
        teacherId,
      },
    });

    if (!permission) {
      throw new NotFoundException('Quyền không tồn tại');
    }

    await this.permissionRepo.remove(permission);
  }

  /**
   * Lấy danh sách quyền của giáo viên cho bài giảng
   */
  async getPermissionsByLecture(
    lectureId: string,
  ): Promise<TeacherLecturePermissionResponseDto[]> {
    const permissions = await this.permissionRepo.find({
      where: { lectureId },
      relations: ['teacher'],
      order: { createdAt: 'DESC' },
    });

    return permissions.map((p) => this.toResponseDto(p));
  }

  /**
   * Lấy quyền của giáo viên cho một bài giảng
   */
  async getPermission(
    lectureId: string,
    teacherId: string,
  ): Promise<TeacherLecturePermissionResponseDto | null> {
    const permission = await this.permissionRepo.findOne({
      where: {
        lectureId,
        teacherId,
      },
    });

    return permission ? this.toResponseDto(permission) : null;
  }

  /**
   * Kiểm tra giáo viên có quyền xem bài giảng không
   */
  async canTeacherViewLecture(
    teacherId: string,
    lectureId: string,
  ): Promise<boolean> {
    const now = new Date();
    const permission = await this.permissionRepo
      .createQueryBuilder('p')
      .where('p.lectureId = :lectureId', { lectureId })
      .andWhere('p.teacherId = :teacherId', { teacherId })
      .andWhere('(p.expiresAt IS NULL OR p.expiresAt > :now)', { now })
      .getOne();

    return !!permission;
  }

  /**
   * Lấy danh sách bài giảng mà giáo viên được xem
   */
  async getLecturesForTeacher(teacherId: string): Promise<LectureEntity[]> {
    const now = new Date();
    const permissions = await this.permissionRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.lecture', 'lecture')
      .where('p.teacherId = :teacherId', { teacherId })
      .andWhere('(p.expiresAt IS NULL OR p.expiresAt > :now)', { now })
      .getMany();

    return permissions.map((p) => p.lecture);
  }
}
