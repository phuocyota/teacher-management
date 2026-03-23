# Tổng Quan Source - Teacher Management API

Project này là NestJS monolith dùng TypeORM + PostgreSQL, tổ chức theo domain module. Mỗi domain thường có `module`, `controller`, `service`, `entity`, `dto`, và đôi khi có `enum` hoặc `services/entity/controller` con.

Tài liệu này được cập nhật theo source hiện tại trong `src/`, không dựa trên tài liệu cũ.

## 1. Entry Points

- `src/main.ts`
  - Bootstrap `NestExpressApplication`
  - Bật Swagger tại `/swagger`
  - Bật CORS cho một số origin cố định
  - Gắn global interceptors:
    - `ResponseLoggerInterceptor`
    - `SuccessResponseInterceptor`
  - Serve static thư mục `uploads` tại `/uploads`
  - Listen port `process.env.PORT ?? 3001` trên `0.0.0.0`

- `src/app.module.ts`
  - Nạp `.env` bằng `ConfigModule.forRoot({ isGlobal: true })`
  - Kết nối PostgreSQL qua `TypeOrmModule.forRootAsync`
  - Đăng ký toàn bộ entity trực tiếp trong `entities: []`
  - `synchronize: true`
  - Gắn global:
    - `APP_FILTER` -> `AllExceptionsFilter`
    - `APP_GUARD` -> `AuthGuard`
  - Gắn `RequestLoggerMiddleware` cho toàn bộ route
  - Serve static thêm một root Linux cố định: `/var/www/teacher-management/uploads`

## 2. Runtime Request Pipeline

Luồng request hiện tại:

1. Request đi qua `RequestLoggerMiddleware`
2. `AuthGuard` kiểm tra JWT cho mọi route, trừ route có `@Public()`
3. Controller gọi service theo domain
4. Nếu lỗi:
   - `AllExceptionsFilter` chuẩn hóa lỗi thành JSON
5. Nếu thành công:
   - `SuccessResponseInterceptor` bọc response thành:
     - `success`
     - `message`
     - `data`

Lưu ý:

- `AuthGuard` chỉ verify JWT bằng `JWT_SECRET`, sau đó attach `request.user`
- Guard không check token có còn tồn tại trong bảng `token` hay không; việc check token sống/chết nằm trong `AuthService.isTokenAlive()`

## 3. Stack Và Convention

- Framework: NestJS 11
- ORM: TypeORM 0.3
- DB: PostgreSQL
- Auth: JWT + `jsonwebtoken`
- Password: `bcryptjs`
- Docs: `@nestjs/swagger`
- Upload/stream: local filesystem, chunk upload, unzip
- Test hiện có rất ít; repo gần như chưa có unit spec trong `src/`

Pattern chung:

- Controller mỏng, logic nằm ở service
- DTO dùng cho request/response
- Entity thường kế thừa `src/common/sql/base.entity.ts`
- Phân trang dùng `PaginationResponseDto`
- Map entity -> DTO dùng `autoMapListToDto`

## 4. Module Đang Được Wire Trong AppModule

Các module đã được import vào runtime:

- `AuthModule`
- `TeacherModule`
- `LectureModule`
- `UserModule`
- `LicenseModule`
- `DeviceModule`
- `SocketModule`
- `ClassModule`
- `CourseModule`
- `UploadModule`
- `GroupModule`
- `UserGroupModule`
- `QuestionBankModule`
- `QuestionModule`
- `AnswerModule`
- `StudentModule`
- `SchoolModule`
- `StudentGroupModule`
- `StudentAnswerModule`
- `QuestionBankQuestionModule`
- `AttemptModule`
- `GradeModule`
- `SubjectModule`
- `ExamSetModule`
- `ExamSetQuestionBankModule`

## 5. Bản Đồ Domain

### Người dùng và phân quyền

- `auth/`
  - Route: `auth/*`
  - Chức năng:
    - `login/admin`
    - `login/teacher`
    - `login/student`
    - `register`
    - `token/check`
  - `AuthService` sinh JWT 1 năm, lưu token vào bảng `token`

- `user/`
  - Route: `users`
  - CRUD user, đổi password, toggle disabled
  - Là nguồn dữ liệu đăng nhập chính

- `teacher/`
  - Route: `teacher`
  - CRUD hồ sơ giáo viên

- `student/`
  - Route: `student`
  - CRUD hồ sơ học sinh

- `device/`
  - Route: `device`
  - Quản lý yêu cầu thiết bị và danh sách thiết bị đã duyệt

### Cấu trúc tổ chức học tập

- `school/`
  - Route: `school`
  - CRUD trường học

- `student-group/`
  - Route: `student-group`
  - CRUD nhóm học sinh

- `group/`
  - Route: `groups`
  - CRUD nhóm chung, tìm kiếm, lấy max code, thống kê số lượng

- `user-group/`
  - Route: `user-groups`
  - Quản lý membership giữa user và group
  - Có API kiểm tra membership, lấy role, lấy group của user, thêm/xóa member

- `class/`
  - Route: `classes`
  - CRUD lớp

- `course/`
  - Route: `courses`
  - CRUD khóa học
  - Có route `max-code` và `options`

- `grade/`
  - Route: `grade`
  - CRUD khối/lớp học theo cấp

- `subject/`
  - Route: `subject`
  - CRUD môn học

### Nội dung giảng dạy

- `lecture/`
  - Route:
    - `lecture`
    - `lecture/user`
    - `lecture/group`
    - `lecture/download-log`
  - Chức năng:
    - CRUD bài giảng
    - Gán bài giảng cho user
    - Gán bài giảng cho group
    - Log tải bài giảng
  - Có các entity con:
    - `LectureEntity`
    - `LectureUserEntity`
    - `LectureGroupEntity`
    - `LectureDownloadLogEntity`
    - `LectureResourceEntity`

- `upload/`
  - Route:
    - `upload/*`
    - `updateversion`
  - Chức năng:
    - upload single/multiple/folder
    - chunked upload
    - cấp quyền truy cập file
    - download / stream / serve image
    - unzip file zip
    - ghi và đọc `ichiteacher/version.json`
  - `UploadService` đang giữ session chunk upload bằng in-memory `Map`, nên restart process sẽ mất session

- `license/`
  - Route: `licenses`
  - CRUD license

### Ngân hàng đề và làm bài

- `question-bank/`
  - Route: `question-bank`
  - CRUD đề/ngân hàng đề
  - Có route import PDF: `POST question-bank/:id/import-pdf`

- `question/`
  - Route: `question`
  - CRUD câu hỏi
  - Có route `:id/chain` để đọc chuỗi nội dung kế tiếp

- `answer/`
  - Route: `answer`
  - CRUD đáp án
  - Có route `:id/chain`
  - Entity hiện có `isCorrect`, `orderNo`, `nextContent`

- `question-bank-question/`
  - Route: `question-bank-question`
  - Bảng nối giữa đề và câu hỏi
  - Lưu `orderNo`, `points`

- `exam-set/`
  - Route: `exam-set`
  - CRUD bộ đề/ca thi

- `exam-set-question-bank/`
  - Route: `exam-set-question-bank`
  - Bảng nối giữa `exam_set` và `question_bank`

- `attempt/`
  - Route: `attempt`
  - Chức năng chính:
    - tạo bản ghi attempt
    - `start`
    - `:id/end`
    - `exam-history`
    - `exam-history/detail`
    - `by-exam`
    - `:id/review`
  - `AttemptService` là service nghiệp vụ phức tạp nhất hiện tại
  - Tự bảo đảm user kiểu `STUDENT` có student profile trước khi bắt đầu làm bài
  - Tính điểm bằng cách so sánh tập đáp án nộp với tập `answer.isCorrect`
  - Hỗ trợ payload FE dạng chuỗi như `1A`, `2BD`

- `student-answer/`
  - Route: `student-answer`
  - CRUD chi tiết câu trả lời theo từng attempt

### Realtime

- `socket/`
  - Chứa `SocketGateway`
  - Hiện là module realtime riêng, không phải trung tâm của nghiệp vụ CRUD

## 6. Common Layer

`src/common/` chứa phần dùng chung:

- `constant/`
  - constants và error messages
- `database/transaction.utils.ts`
  - helper transaction
- `decorator/`
  - `@Public()`
  - `@Roles()`
  - `@User()`
- `dto/`
  - DTO base và pagination
- `enum/`
  - `UserType`, `Status`, `ContentType`
- `filter/`
  - `AllExceptionsFilter`
- `guard/`
  - `AuthGuard`
  - `RolesGuard`
- `interceptors/`
  - success logger / response logger
- `middleware/`
  - request logger
- `sql/`
  - `BaseEntity`, `BaseService`
- `utils/`
  - `auto-map.util.ts`
  - `array-diff.utils.ts`

## 7. Data Model Và Quan Hệ Nổi Bật

- `user` là thực thể identity trung tâm
- `teacher` và `student` là hồ sơ theo role
- `group` + `user_group` quản lý group membership
- `lecture` đi cùng:
  - `lecture_user`
  - `lecture_group`
  - `lecture_download_log`
  - `lecture_resource`
- `question_bank` đi cùng:
  - `question_bank_question`
  - `attempt`
- `attempt` đi cùng:
  - `student_answer`
- `exam_set` đi cùng:
  - `exam_set_question_bank`
- `upload` đi cùng:
  - `file`
  - `file_access`

## 8. Những Điểm Cần Biết Khi Sửa Source

- `synchronize: true` đang bật, nên thay đổi entity có thể tác động schema ngay khi app chạy
- `AppModule` đang khai báo entity bằng tay; thêm bảng mới phải cập nhật `entities: []`
- Có hai cấu hình static uploads:
  - trong `ServeStaticModule.forRoot`
  - trong `main.ts`
  - khi deploy cần kiểm tra lại đường dẫn đang dùng thật
- `UploadService` xử lý khá nhiều logic filesystem trực tiếp; cần cẩn thận với path, rename, delete
- Phần import PDF, unzip, và chain content có tính domain-specific cao; không nên refactor cơ học nếu chưa đọc flow

## 9. Route Prefix Tổng Hợp

Các prefix controller hiện có:

- `/auth`
- `/users`
- `/teacher`
- `/student`
- `/device`
- `/licenses`
- `/classes`
- `/courses`
- `/groups`
- `/user-groups`
- `/lecture`
- `/lecture/user`
- `/lecture/group`
- `/lecture/download-log`
- `/upload`
- `/updateversion`
- `/question-bank`
- `/question`
- `/answer`
- `/question-bank-question`
- `/attempt`
- `/student-answer`
- `/school`
- `/student-group`
- `/grade`
- `/subject`
- `/exam-set`
- `/exam-set-question-bank`

## 10. Gợi Ý Đọc Code Theo Thứ Tự

Nếu cần onboard nhanh, nên đọc theo thứ tự:

1. `src/main.ts`
2. `src/app.module.ts`
3. `src/common/guard/auth.guard.ts`
4. `src/auth/auth.service.ts`
5. `src/user/*`
6. `src/attempt/*`
7. `src/question-bank/*`, `src/question/*`, `src/answer/*`
8. `src/upload/*`
9. `src/lecture/*`

## 11. File Quan Trọng

- `src/main.ts`
- `src/app.module.ts`
- `src/common/guard/auth.guard.ts`
- `src/common/filter/all-exceptions.filter.ts`
- `src/common/interceptors/success-response.interceptor.ts`
- `src/auth/auth.service.ts`
- `src/attempt/attempt.service.ts`
- `src/upload/upload.service.ts`
- `src/question-bank/question-bank.service.ts`
- `src/lecture/services/lecture.service.ts`
