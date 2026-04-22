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
  - Khi import PDF, câu hỏi dạng `MATCHING` và `ORDERING` không tách thành nhiều `question` độc lập; hệ thống lưu một `question` gốc, sau đó dùng `meta` để mô tả cấu trúc hiển thị và ánh xạ đáp án.

- `question/`
  - Route: `question`
  - CRUD câu hỏi
  - Có route `:id/chain` để đọc chuỗi nội dung kế tiếp
  - `question.meta` dùng để lưu metadata nghiệp vụ cho các kiểu câu đặc biệt như `MATCHING` và `ORDERING`
  - Khi `type = MATCHING`, FE phải render theo format:

```json
{
  "leftItems": [
    { "key": "1", "text": "Giữ gìn đồ dùng cá nhân" },
    { "key": "2", "text": "Giúp đỡ bạn bè" },
    { "key": "3", "text": "Lễ phép với người lớn" }
  ],
  "rightItems": [
    { "key": "a", "text": "Được mọi người yêu quý" },
    { "key": "b", "text": "Đồ dùng bền và gọn gàng" },
    { "key": "c", "text": "Có thêm bạn tốt" }
  ]
}
```

- `answer/`
  - Route: `answer`
  - CRUD đáp án
  - Có route `:id/chain`
  - Entity hiện có `isCorrect`, `orderNo`, `nextContent`
  - Với `MATCHING` và `ORDERING`, `answer.meta` dùng để lưu dữ liệu nghiệp vụ mở rộng, ví dụ:
    - `MATCHING`: `leftKey`, `leftText`, `rightKey`, `rightText`
    - `ORDERING`: `position`, `label`

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
- Khi thêm kiểu câu hỏi mới:
  - `QuestionType` phải được mở rộng tương ứng
  - `question.meta` dùng cho dữ liệu hiển thị/render
  - `answer.meta` dùng cho mapping/chấm điểm nghiệp vụ
  - FE không nên suy luận `MATCHING` hoặc `ORDERING` như câu trắc nghiệm thường

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

## 10. API Quick Lookup (Question / Answer / Attempt)

Muc nay de tim nhanh API theo nhu cau hay gap khi lam de va nop bai.

### 10.1 Tra cuu nhanh endpoint

| Nhu cau | Method + path | Ghi chu |
|---|---|---|
| Tao cau hoi | `POST /question` | Tao 1 phan noi dung cau hoi goc |
| Cap nhat cau hoi | `PATCH /question/:id` | Sua noi dung/loai cau hoi |
| Lay chain cau hoi | `GET /question/:id/chain` | Lay day du cac phan noi dung theo `nextContent` |
| Tao dap an cho cau hoi cu the | `POST /answer` | Body can `questionId`, `contentType`, `content` |
| Cap nhat dap an | `PATCH /answer/:id` | Co the sua `isCorrect`, `orderNo`, `content`, ... |
| Lay dap an theo cau hoi | `GET /answer?questionId=<questionId>` | Loc nhanh toan bo dap an cua 1 cau hoi |
| Lay chain dap an | `GET /answer/:id/chain` | Lay day du chuoi noi dung dap an |
| Tao student-answer thu cong | `POST /student-answer` | Luu cau tra loi hoc sinh cho 1 cau hoi |
| Nop bai va luu toan bo cau tra loi | `POST /attempt/:id/end` | API chinh khi student submit bai |
| Xem bai da nop (dung/sai) | `GET /attempt/:id/review` | Tra ve dap an hoc sinh + dap an dung |

### 10.2 Payload toi thieu thuong dung

1. Tao dap an cho 1 cau hoi (`POST /answer`)

```json
{
  "questionId": "2233abe3-1961-4af5-a482-542f1227d844",
  "contentType": "TEXT",
  "content": "Paris",
  "isCorrect": true
}
```

2. Nop bai va luu cau tra loi theo tung cau (`POST /attempt/:id/end`) - object format

```json
{
  "answers": [
    {
      "questionId": "5233abe3-1961-4af5-a482-542f1227d844",
      "answerId": "6233abe3-1961-4af5-a482-542f1227d844"
    }
  ]
}
```

3. Nop bai theo format FE rut gon (`POST /attempt/:id/end`) - string format

```json
{
  "answers": ["1B", "2A", "3A", "4A", "7C", "8C", "9B", "10A"]
}
```

Quy uoc:
- `1B` = cau thu tu 1, chon dap an B.
- `10A` = cau thu tu 10, chon dap an A.
- Co ho tro nhieu lua chon, vi du `2BD` (chon B va D cho cau 2).
- Khong truyen rong ky tu dap an (chi A-Z) va so thu tu cau phai ton tai trong de.

4. Tao student-answer thu cong (`POST /student-answer`)

```json
{
  "attemptId": "2233abe3-1961-4af5-a482-542f1227d844",
  "questionId": "3233abe3-1961-4af5-a482-542f1227d844",
  "answerId": "4233abe3-1961-4af5-a482-542f1227d844"
}
```

### 10.3 Rule chon API nhanh

- Neu la teacher/admin dang soan de: uu tien `question` + `answer`.
- Neu la student dang lam bai: uu tien `attempt/start` va `attempt/:id/end`.
- `student-answer` dung cho luu/chinh sua thu cong tung dong; submit chuan van la `attempt/:id/end`.
- Khi goi `attempt/:id/end`, nen dung mot kieu format nhat quan trong ca mang `answers` (toan object hoac toan string).

## 11. Gợi Ý Đọc Code Theo Thứ Tự

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

## 12. File Quan Trọng

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

## 13. Quy Tac Render Matching Va Ordering

- `MATCHING` la mot cau hoi goc, khong tach thanh nhieu cau hoi con khi import.
- `question.meta` la nguon du lieu chinh cho FE render cau `MATCHING`.
- Dinh dang `question.meta` cho `MATCHING` phai theo mau:

```json
{
  "leftItems": [
    { "key": "1", "text": "Giữ gìn đồ dùng cá nhân" },
    { "key": "2", "text": "Giúp đỡ bạn bè" },
    { "key": "3", "text": "Lễ phép với người lớn" }
  ],
  "rightItems": [
    { "key": "a", "text": "Được mọi người yêu quý" },
    { "key": "b", "text": "Đồ dùng bền và gọn gàng" },
    { "key": "c", "text": "Có thêm bạn tốt" }
  ]
}
```

- Khi tra ve `chain` hoac `nextContentDetails`, neu `type = MATCHING` thi phai giu `meta` o moi node de FE co the render dung.
- `answer.meta` la mapping nghiep vu cho cap ghep, vi du `leftKey`, `leftText`, `rightKey`, `rightText`.
- `ORDERING` hien tai duoc import ve cung dang `MATCHING`, nhung `answer` de trong; du lieu hinh anh va danh sach buoc nam trong `question.meta`.
## Cập Nhật Gần Đây

- Luồng import PDF ở `question-bank` đã hỗ trợ tách inline `Đáp án: 1.C, 2.D...` ngay khi nó nằm chung một dòng với nội dung câu hỏi.
- Parser giờ nhận được cả hai kiểu:
  - `Đáp án:` đứng riêng một dòng
  - `Đáp án:` dính chung với câu hỏi trong cùng một dòng
- Dữ liệu đáp án dạng `1.C, 2.D, 3.A...` cũng được parse trực tiếp vào `answerKey`.
- Test đã được thêm để khóa hành vi này trong `src/question-bank/services/question-parser.service.spec.ts`.
