# Tổng Quan Source (Teacher Management API)

Dự án là NestJS monolith, tổ chức theo module theo domain. Dùng TypeORM
(entity + repository), DTO cho request/response, và các tiện ích chung
trong `src/common`. Tài liệu này giúp đọc nhanh cấu trúc và thêm API mới
mà không phá cấu trúc cũ.

## 1) Cấu Trúc Tổng Quan

- `src/main.ts` bootstrap app + Swagger.
- `src/app.module.ts` khai báo module + global guard/interceptor/filter.
- Mỗi domain nằm trong `src/<domain>/` gồm:
  - `*.module.ts`
  - `*.controller.ts`
  - `*.service.ts`
  - `entity/*.entity.ts`
  - `dto/*.dto.ts`
  - `enum/*.enum.ts`

## 2) Danh Sách Module

- `auth/` đăng nhập + đăng ký
- `class/` quản lý lớp
- `course/` quản lý khóa học
- `device/` request/approve thiết bị
- `group/` quản lý nhóm
- `lecture/` bài giảng + lecture_user + lecture_group + download_log
- `license/` quản lý license
- `socket/` websocket gateway
- `teacher/` quản lý giáo viên
- `upload/` upload/stream file + phân quyền truy cập
- `user/` quản lý người dùng
- `user-group/` membership + roles

## 3) Thành Phần Dùng Chung

- `src/common/sql/base.entity.ts` fields chung (id, createdAt, ...)
- `src/common/sql/base.service.ts` helper CRUD (nếu dùng)
- `src/common/database/transaction.utils.ts` helper transaction
- `src/common/constant/error-messages.constant.ts` thông báo lỗi chuẩn
- `src/common/dto/pagination.dto.ts` request/response phân trang
- `src/common/utils/auto-map.util.ts` map raw DB -> DTO
- Guards/interceptors/filters:
  - `common/guard/auth.guard.ts` (global)
  - `common/guard/roles.guard.ts`
  - `common/interceptors/*`
  - `common/filter/all-exceptions.filter.ts`
  - `common/decorator/*` (public/roles/user)

## 4) Pattern Auth + Permission

- AuthGuard áp dụng global (xem `app.module.ts`).
- Dùng `@Public()` cho endpoint public.
- Dùng `@Roles()` + `RolesGuard` cho role-based.
- Nhiều service kiểm tra `user.userType` để phân quyền.

## 5) Pattern DB + Entity

- Entity kế thừa `BaseEntity`.
- `synchronize: true` đang bật (xem `app.module.ts`).
- Repository inject bằng `@InjectRepository(Entity)`.

## 6) Lưu Ý Module Lecture

Lecture có nhiều sub-controller/service:
- `lecture.controller.ts` (CRUD bài giảng)
- `lecture_user.*` phân bài giảng theo user
- `lecture_group.*` phân bài giảng theo group
- `lecture_download_log.*` lịch sử download

## 7) Lưu Ý Module Upload

- `upload.service.ts` xử lý upload, phân quyền, chunked upload, unzip.
- `stream.service.ts` xử lý download/stream response.

## 8) Thêm API Mới (Checklist)

1) Chọn domain module (hoặc tạo module mới).
2) Thêm DTOs trong `src/<domain>/dto/`.
3) Thêm method trong `src/<domain>/<domain>.service.ts`.
4) Thêm route trong `src/<domain>/<domain>.controller.ts`.
5) Nếu cần, export/import module trong `src/<domain>/<domain>.module.ts`.
6) Nếu thêm bảng mới:
   - tạo entity trong `src/<domain>/entity/`
   - thêm entity vào list TypeORM trong `app.module.ts`
7) Dùng lại pattern chung:
   - lỗi từ `ERROR_MESSAGES`
   - phân trang `PaginationResponseDto`
   - phân quyền bằng `UserType` + guard
   - transaction với `runInTransaction`
8) Cập nhật Swagger decorators nếu cần.
9) Viết unit tests trong `src/**/**/*.spec.ts`.

## 9) Quy Ước Để Không Phá Cấu Trúc

- Giữ module self-contained (controller + service + DTO + entity).
- Không bypass các tiện ích chung (error messages, pagination, ...).
- Dùng `runInTransaction` cho các luồng ghi nhiều bước.
- Controller mỏng; business logic đặt ở service.
- Enum/constant mới đặt trong `enum/` hoặc `common/constant/`.

## 10) Entry Points Quan Trọng

- `src/main.ts` (bootstrap + Swagger + global interceptors)
- `src/app.module.ts` (wiring modules + global providers)
- `src/common/*` (shared behaviors)

