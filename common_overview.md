# Tổng quan và hướng dẫn sử dụng `src/common`

## 1. Mục đích

`src/common` chứa các thành phần dùng chung cho toàn bộ ứng dụng NestJS: entity/DTO nền, xác thực và phân quyền, chuẩn hóa response/lỗi, transaction, mapping dữ liệu, enum, hằng số và tiện ích mảng.

Tài liệu này mô tả **hành vi thực tế của code hiện tại** và cách dùng an toàn. Các import trong dự án đang dùng cả alias `src/...` lẫn đường dẫn tương đối; với code trong `src`, nên ưu tiên một kiểu nhất quán như:

```ts
import { BaseEntity } from 'src/common/sql/base.entity';
```

## 2. Cấu trúc nhanh

```text
src/common/
├── constant/       Hằng số và thông báo lỗi
├── database/       Helper chạy TypeORM transaction
├── decorator/      @Public, @Roles, @User
├── dto/            DTO nền và phân trang
├── enum/           Enum dùng chung
├── filter/         Chuẩn hóa và log exception
├── guard/          Xác thực JWT và kiểm tra vai trò
├── interceptors/   Log response và bọc response thành công
├── interface/      Kiểu JwtPayload
├── middleware/     Log request; middleware auth cũ
├── sql/            BaseEntity và BaseService
└── utils/          Mapping DTO và so sánh mảng
```

## 3. Luồng HTTP đang được cấu hình

Các thành phần sau đã được đăng ký toàn cục:

- `RequestLoggerMiddleware`: áp dụng cho mọi route trong `AppModule`.
- `AuthGuard`: `APP_GUARD`, mặc định mọi route đều cần JWT.
- `AllExceptionsFilter`: `APP_FILTER`, bắt mọi exception.
- `ResponseLoggerInterceptor`: global interceptor trong `main.ts`.
- `SuccessResponseInterceptor`: global interceptor trong `main.ts`.

Luồng điển hình:

```text
Request
  -> log request
  -> AuthGuard kiểm tra JWT (trừ route có @Public)
  -> RolesGuard nếu controller/handler khai báo @UseGuards(RolesGuard)
  -> controller/service
  -> log và bọc response thành công

Exception
  -> AllExceptionsFilter log và trả error response
```

Response thành công thông thường:

```json
{
  "success": true,
  "message": "Thành công",
  "data": {}
}
```

Response lỗi:

```json
{
  "statusCode": 404,
  "message": "Giáo viên không tồn tại",
  "error": "Not Found",
  "timestamp": "2026-08-03T03:00:00.000Z",
  "path": "/teachers/id",
  "method": "GET"
}
```

## 4. Xác thực, phân quyền và người dùng hiện tại

### 4.1 `AuthGuard` và `@Public()`

`AuthGuard` là guard toàn cục. Route không có `@Public()` phải gửi:

```http
Authorization: Bearer <jwt>
```

JWT hợp lệ phải có ít nhất `userId` và `userType`:

```ts
interface JwtPayload {
  userId: string;
  userType: UserType;
  deviceId?: string;
  iat?: number;
  exp?: number;
}
```

Khai báo route hoặc cả controller công khai:

```ts
import { Public } from 'src/common/decorator/public.decorator';

@Public()
@Post('login')
login(@Body() dto: LoginDto) {
  return this.authService.login(dto);
}
```

`AuthGuard` gắn payload đã decode vào `request.user`. Secret được lấy từ `JWT_SECRET`; nếu biến môi trường này không có, guard hiện fallback sang chuỗi `secretKey`.

### 4.2 `@User()`

Dùng decorator này để lấy toàn bộ user hoặc một trường trong JWT payload:

```ts
import { User } from 'src/common/decorator/user.decorator';
import type { JwtPayload } from 'src/common/interface/jwt-payload.interface';

@Get('me')
findMe(@User() user: JwtPayload) {
  return this.userService.findOne(user.userId);
}

@Get('my-id')
findMyId(@User('userId') userId: string) {
  return userId;
}
```

Nếu request không có `user`, decorator trả `null`. Trên route được bảo vệ bởi global `AuthGuard`, trường hợp này bình thường không xảy ra.

### 4.3 `@Roles()` và `RolesGuard`

`@Roles()` chỉ lưu metadata; muốn kiểm tra quyền, route/controller phải dùng thêm `@UseGuards(RolesGuard)`:

```ts
import { UseGuards } from '@nestjs/common';
import { Roles } from 'src/common/decorator/roles.decorator';
import { RolesGuard } from 'src/common/guard/roles.guard';
import { UserType } from 'src/common/enum/user-type.enum';

@Post()
@UseGuards(RolesGuard)
@Roles(UserType.ADMIN, UserType.TEACHER)
create() {
  // ADMIN hoặc TEACHER được phép gọi
}
```

Nếu không có `@Roles()` thì `RolesGuard` cho qua. Nếu user không tồn tại hoặc `userType` không khớp, guard trả HTTP 403.

Các vai trò hiện có: `ADMIN`, `TEACHER`, `STUDENT`, `KINH_DOANH`.

### 4.4 `AuthorizationMiddleware`

`authorization.middleware.ts` cũng xác thực JWT nhưng **hiện không được đăng ký** trong `AppModule`; ứng dụng đang dùng `AuthGuard`. Không nên đăng ký đồng thời cả hai vì sẽ xác thực lặp, và hai implementation còn khác nhau về fallback của `JWT_SECRET`.

## 5. Entity, DTO và service nền

### 5.1 `BaseEntity`

Entity nghiệp vụ nên kế thừa `BaseEntity` để có sẵn:

- `id`: UUID tự sinh.
- `createdAt`, `updatedAt`: TypeORM tự quản lý, map tới `created_at`, `updated_at`.
- `createdBy`, `updatedBy`: nullable, map tới `created_by`, `updated_by`.

```ts
import { Column, Entity } from 'typeorm';
import { BaseEntity } from 'src/common/sql/base.entity';

@Entity('subjects')
export class SubjectEntity extends BaseEntity {
  @Column()
  name: string;
}
```

`BaseEntity` không có trường `status` và không tự triển khai soft delete.

### 5.2 `BaseDto` và `MaxCodeResponseDto`

DTO response có thể kế thừa `BaseDto` để khai báo các trường audit tương ứng:

```ts
export class SubjectResponseDto extends BaseDto {
  name: string;
}
```

`MaxCodeResponseDto` mô tả response `{ maxCode: number }` cho Swagger.

### 5.3 `BaseService<T>`

Kế thừa service này khi entity đã kế thừa `BaseEntity`:

```ts
@Injectable()
export class TeacherService extends BaseService<TeacherEntity> {
  constructor(
    @InjectRepository(TeacherEntity)
    teacherRepository: Repository<TeacherEntity>,
  ) {
    super(teacherRepository);
  }

  protected getEntityName(): string {
    return 'Giáo viên';
  }
}
```

Các method có sẵn:

| Method | Hành vi |
| --- | --- |
| `findAll()` | Lấy tất cả bản ghi bằng `repo.find()` |
| `findById(id)` | Trả entity hoặc `null` |
| `findOne(id)` | Trả entity; không có thì ném 404 |
| `findByIds(ids)` | Tìm theo `In(ids)`; ném 404 chỉ khi không tìm thấy bản ghi nào |
| `create(dto, user, manager?)` | Gán `createdBy = user.userId`, có thể dùng repository từ transaction manager |
| `update(id, dto, user)` | Gán DTO và `updatedBy`, sau đó save |
| `delete(id, user)` | Hiện chỉ cập nhật `updatedBy` rồi save |
| `hardDelete(id)` | Xóa vật lý bằng `repo.remove()` |

Nên override `getEntityName()` để thông báo 404 có tên đúng. Lưu ý `findByIds()` không bảo đảm tìm đủ toàn bộ ID được truyền vào; nếu nghiệp vụ yêu cầu đủ, cần tự so sánh số lượng hoặc tập ID.

Hai điểm quan trọng của implementation hiện tại:

1. `delete()` được chú thích là soft delete nhưng **không đổi `status` thành `DELETED`**. Muốn soft delete thực sự, service con phải tự gán status hoặc dùng cơ chế soft-delete của TypeORM.
2. `BaseService.runInTransaction(callback)` không truyền transaction manager vào callback, và các method dùng repository gốc sẽ không tự tham gia `QueryRunner` vừa tạo. Với nghiệp vụ nhiều thao tác, hãy dùng helper ở `database/transaction.utils.ts` bên dưới.

## 6. Transaction

Helper được khuyến nghị:

```ts
import { runInTransaction } from 'src/common/database/transaction.utils';

return runInTransaction(this.entityManager, async (manager) => {
  const subjectRepo = manager.getRepository(SubjectEntity);
  const gradeRepo = manager.getRepository(GradeEntity);

  const subject = await subjectRepo.save(subjectRepo.create(subjectData));
  await gradeRepo.save(gradeRepo.create({ ...gradeData, subjectId: subject.id }));

  return subject;
});
```

Quy tắc bắt buộc: mọi truy vấn cần nằm trong transaction phải chạy qua `manager` được callback cung cấp, hoặc repository lấy từ `manager`. Không dùng repository inject sẵn bên trong callback.

Helper sẽ `commit` khi callback thành công, `rollback` khi callback ném lỗi và luôn `release` query runner.

## 7. Phân trang

### 7.1 Request DTO

`PaginationRequestDto` có:

- `page?: number = 1`, tối thiểu 1.
- `size?: number = 10`, tối thiểu 1.
- `search?: string`.

Ví dụ kế thừa:

```ts
export class GetSubjectsDto extends PaginationRequestDto {
  schoolId?: string;
}
```

Query parameter HTTP ban đầu là chuỗi. Để `@IsNumber()` hoạt động đúng và giá trị mặc định được áp dụng trên instance DTO, controller cần pipe có `transform: true`:

```ts
@Get()
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
findAll(@Query() query: GetSubjectsDto) {
  return this.subjectService.findAll(query);
}
```

Do `main.ts` hiện chưa đăng ký `ValidationPipe` toàn cục, phải kiểm tra pipe của controller/module trước khi dựa vào validation hoặc default của DTO.

### 7.2 Response DTO

`PaginationResponseDto<T>` có cấu trúc:

```ts
{
  page: number;
  size: number;
  total: number;
  data: T[];
}
```

Ví dụ service:

```ts
const page = Number(query.page ?? 1);
const size = Number(query.size ?? 10);
const [data, total] = await this.repo.findAndCount({
  skip: (page - 1) * size,
  take: size,
});

return { page, size, total, data };
```

Giá trị này sau đó vẫn được `SuccessResponseInterceptor` đặt trong trường `data` của response ngoài.

## 8. Mapping dữ liệu sang DTO

### 8.1 `autoMapToDto`

```ts
const dto = autoMapToDto(SubjectResponseDto, raw);
```

### 8.2 `autoMapListToDto`

```ts
const data = autoMapListToDto(SubjectResponseDto, rows);
```

Mapper tạo instance DTO và copy nông mọi key từ dữ liệu nguồn. Quy tắc chuyển kiểu:

- `null`/`undefined`: giữ nguyên.
- Chuỗi chỉ chứa số hoặc số thập phân dương: đổi sang `number`.
- Chuỗi ISO UTC dạng `YYYY-MM-DDTHH:mm:ss(.sss)Z`: đổi sang `Date`.
- Chuỗi khác, object và array: giữ nguyên.

Giới hạn cần nhớ:

- Mapper không dựa vào decorator/type metadata của DTO.
- Không loại bỏ field thừa và không map object lồng nhau thành DTO con.
- Chuỗi mã như `"00123"` sẽ thành số `123`.
- Số âm, số có dấu `+`, dạng mũ và date có timezone offset không được chuyển.

Vì vậy chỉ dùng với raw data đã biết cấu trúc. Với mã số cần giữ số 0 đầu, hãy map thủ công hoặc sửa giá trị sau khi map.

## 9. So sánh hai mảng

`diffArray(current, next)` trả các phần tử cần thêm và xóa:

```ts
const { toAdd, toRemove } = diffArray(
  ['user-a', 'user-b'],
  ['user-b', 'user-c'],
);

// toAdd    = ['user-c']
// toRemove = ['user-a']
```

Hàm dùng `Set`, nên phần tử trùng lặp bị gộp và thứ tự kết quả theo thứ tự xuất hiện đầu tiên. Với object, so sánh theo tham chiếu chứ không theo nội dung; nên truyền ID/string/number hoặc tự chuẩn hóa trước.

## 10. Hằng số và enum

### `ERROR_MESSAGES` và `ENTITY_NAMES`

Dùng thông báo lỗi tập trung thay vì viết chuỗi rải rác:

```ts
throw new NotFoundException(
  ERROR_MESSAGES.NOT_FOUND(ENTITY_NAMES.SUBJECT),
);
```

`ERROR_MESSAGES` gồm nhóm auth, not-found, device, group, user và input. `ENTITY_NAMES` chứa tên hiển thị tiếng Việt của các entity phổ biến.

### `EMPTY_UUID`

```ts
export const EMPTY_UUID = '00000000-0000-0000-0000-000000000000';
```

Chỉ dùng khi nghiệp vụ hoặc câu SQL thực sự cần UUID rỗng làm sentinel; không dùng thay cho validation UUID.

### Các enum

- `Status`: `ACTIVE`, `INACTIVE`, `DELETED`.
- `UserType`: `ADMIN`, `TEACHER`, `STUDENT`, `KINH_DOANH`.
- `ContentTypes`: `TEXT`, `IMAGE`, `AUDIO`.
- `CertificateSubject`: `STEM`, `Công dân số`, `Kỹ năng sống`.
- `CertificateLevel`: `Hoàn thành tốt`, `Hoàn thành`, `Chưa hoàn thành`, `Đạt`, `Chưa đạt`.

Khi enum được lưu trong database hoặc trả cho frontend, value tiếng Việt là contract dữ liệu; không đổi value tùy tiện nếu chưa có migration và kế hoạch tương thích.

## 11. Response và exception

### `SuccessResponseInterceptor`

Mọi dữ liệu thành công được bọc thành `{ success, message, data }`. Nếu handler đã trả object có thuộc tính `success` (kể cả `false`), interceptor giữ nguyên object đó.

### `AllExceptionsFilter`

Filter:

- Giữ status/message của `HttpException`.
- Trả 500 cho lỗi khác.
- Log 4xx ở mức `warn`, 5xx ở mức `error`.
- Che các field top-level `password`, `hashPassword`, `token`, `secret` trong body khi filter log.

Không nên trả message nội bộ nhạy cảm qua `Error.message`, vì lỗi thường hiện nguyên message ra client. Với lỗi validation, `message` của Nest có thể là một mảng dù interface nội bộ đang khai báo `string`.

## 12. Logging và lưu ý bảo mật

`RequestLoggerMiddleware` log method, URL, IP và toàn bộ body đã `JSON.stringify`. `ResponseLoggerInterceptor` log status, thời gian xử lý và toàn bộ response.

Điều này hữu ích khi debug nhưng có rủi ro ghi mật khẩu, token, dữ liệu cá nhân hoặc payload lớn. Phần sanitize của `AllExceptionsFilter` không bảo vệ log do `RequestLoggerMiddleware` tạo ra. Trước khi dùng ở production nên:

- Che field nhạy cảm cả ở request logger và response logger.
- Không log binary/base64 hoặc response dung lượng lớn.
- Dùng `Logger` của Nest thay cho `console.log` để quản lý level và output.
- Cân nhắc tắt body/response log ở production.

## 13. Checklist khi tạo module mới

1. Entity kế thừa `BaseEntity` nếu cần UUID và audit columns.
2. Response DTO kế thừa `BaseDto` nếu cần các field audit.
3. Dùng `PaginationRequestDto`/`PaginationResponseDto` cho API danh sách và bật transform/validation pipe.
4. Route mặc định là private; chỉ thêm `@Public()` khi thực sự không cần đăng nhập.
5. Với phân quyền, dùng đủ cả `@UseGuards(RolesGuard)` và `@Roles(...)`.
6. Lấy danh tính qua `@User()` và truyền `JwtPayload` xuống service khi cần audit/quyền sở hữu.
7. Dùng `ERROR_MESSAGES`/`ENTITY_NAMES` cho lỗi dùng chung.
8. Nghiệp vụ nhiều thao tác DB dùng `database/runInTransaction` và chỉ truy vấn qua callback `manager`.
9. Chỉ dùng auto mapper khi chấp nhận quy tắc chuyển chuỗi số/date và shallow copy.
10. Kiểm tra response cuối cùng đã được global interceptor bọc thêm một lớp.

## 14. Import tham khảo

```ts
import { BaseEntity } from 'src/common/sql/base.entity';
import { BaseService } from 'src/common/sql/base.service';
import { BaseDto } from 'src/common/dto/base.dto';
import {
  PaginationRequestDto,
  PaginationResponseDto,
} from 'src/common/dto/pagination.dto';
import { Public } from 'src/common/decorator/public.decorator';
import { Roles } from 'src/common/decorator/roles.decorator';
import { User } from 'src/common/decorator/user.decorator';
import { RolesGuard } from 'src/common/guard/roles.guard';
import type { JwtPayload } from 'src/common/interface/jwt-payload.interface';
import { UserType } from 'src/common/enum/user-type.enum';
import {
  ERROR_MESSAGES,
  ENTITY_NAMES,
} from 'src/common/constant/error-messages.constant';
import { runInTransaction } from 'src/common/database/transaction.utils';
import { autoMapToDto, autoMapListToDto } from 'src/common/utils/auto-map.util';
import { diffArray } from 'src/common/utils/array-diff.utils';
```
