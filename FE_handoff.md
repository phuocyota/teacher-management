# FE handoff - API `start-with-group`

Tài liệu này áp dụng cho 2 API bắt đầu bài làm và trả câu hỏi đã được gom theo section:

| Luồng | Endpoint | Xác thực |
| --- | --- | --- |
| Học sinh đã đăng nhập | `POST /attempt/start-with-group` | Bearer token, role `STUDENT` |
| Khách làm bài | `POST /public-attempt/start-with-group` | Public, không cần token |

Backend không đặt global prefix. Ghép các path trên trực tiếp với API base URL của từng môi trường.

## 1. Điểm chung quan trọng

- Thành công trả HTTP `201 Created`.
- Mỗi lần gọi thành công sẽ tạo **một attempt mới** có trạng thái `DOING`. Không gọi lại API khi chỉ refresh/re-render UI.
- Response dùng `data.groups`, **không có** `data.questions` ở top-level.
- Câu hỏi trong mỗi group giữ thứ tự `orderNo` tăng dần từ đề.
- Group có section được sắp theo `group.orderNo`; toàn bộ câu chưa gán section nằm trong một group có `sectionId: null` và group này luôn ở cuối.
- `examName` hiện luôn bằng `questionBankName`, không phải `examSetName`.
- `meta` là dữ liệu mở. Với phần nghe, FE đọc `group.meta.audio` nếu tồn tại.
- Response bắt đầu làm bài đã loại thông tin `isCorrect` trong metadata. FE không được suy đoán đáp án đúng từ response này.

Tất cả response thành công được bọc như sau:

```ts
interface ApiSuccess<T> {
  success: true;
  message: string; // hiện tại: "Thành công"
  data: T;
}
```

Với Axios, payload nghiệp vụ thường nằm ở `response.data.data`.

## 2. API học sinh đã đăng nhập

```http
POST /attempt/start-with-group
Authorization: Bearer <student_access_token>
Content-Type: application/json
```

Request:

```ts
interface StartGroupedAttemptRequest {
  questionBankId: string; // UUID, bắt buộc
  examSetId?: string | null; // UUID, không bắt buộc
}
```

Ví dụ:

```json
{
  "questionBankId": "3233abe3-1961-4af5-a482-542f1227d844",
  "examSetId": "4233abe3-1961-4af5-a482-542f1227d844"
}
```

Quy tắc:

- Token phải hợp lệ và có `userType = STUDENT`.
- Backend lấy học sinh từ token; FE không gửi `studentId`.
- Nếu có `examSetId`, question bank phải thực sự thuộc exam set đó.
- Có thể bỏ hẳn `examSetId` hoặc gửi `null` khi bắt đầu trực tiếp từ question bank.

## 3. API public

```http
POST /public-attempt/start-with-group
Content-Type: application/json
```

Request:

```ts
interface StartPublicGroupedAttemptRequest
  extends StartGroupedAttemptRequest {
  guestName: string; // 1-150 ký tự
}
```

Ví dụ:

```json
{
  "questionBankId": "3233abe3-1961-4af5-a482-542f1227d844",
  "examSetId": null,
  "guestName": "Nguyễn Văn A"
}
```

Quy tắc:

- Không gửi Authorization cũng được.
- `guestName` được trim ở backend và không được rỗng.
- Mỗi lần start, backend tạo một hồ sơ học sinh public riêng. FE cần khóa nút khi đang gửi để tránh double-click tạo nhiều attempt.
- Luồng public phụ thuộc dữ liệu cấu hình backend: trường code `di-ichi` và lớp `test tiếng anh đầu vào` phải tồn tại.

## 4. Kiểu dữ liệu response

```ts
type AttemptStatus = 'DOING' | 'SUBMITTED' | 'EXPIRED';
type QuestionType =
  | 'SINGLE_CHOICE'
  | 'MULTIPLE_CHOICE'
  | 'TEXT_INPUT'
  | 'MATCHING'
  | 'ORDERING';
type ContentType = 'TEXT' | 'IMAGE' | 'AUDIO';

interface StartGroupedAttemptResponse {
  attemptId: string;
  status: AttemptStatus; // khi start thành công: DOING
  startedAt: string; // ISO datetime
  studentId: string | null;
  guestName?: string | null; // có ở luồng public
  questionBankId: string;
  questionBankName: string;
  examSetId?: string | null;
  examSetName?: string | null;
  examName: string;
  groups: AttemptQuestionGroup[];
}

interface AttemptQuestionGroup {
  sectionId: string | null;
  title: string | null;
  instruction: string | null;
  orderNo: number | null;
  meta: GroupMeta | null;
  questions: AttemptQuestion[];
}

interface GroupMeta {
  audio?: {
    label?: string;
    fileId?: string;
    path?: string;
    originalName?: string;
    mimetype?: string;
    size?: number;
  };
  questionFormat?: string;
  questionRange?: { from: number; to: number };
  [key: string]: unknown;
}

interface AttemptQuestion {
  id: string;
  orderNo: number;
  points: number;
  sectionId: string | null;
  sectionTitle: string | null;
  sectionInstruction: string | null;
  sectionOrderNo: number | null;
  type: QuestionType;
  contentType: ContentType;
  content: string;
  meta?: Record<string, unknown> | null;
  nextContent?: string | null;
  chain: QuestionChainItem[];
  answers: AttemptAnswerOption[];
}

interface QuestionChainItem {
  id: string;
  type: QuestionType;
  contentType: ContentType;
  content: string;
  meta?: Record<string, unknown> | null;
  nextContent?: string | null;
}

interface AttemptAnswerOption {
  id: string;
  contentType: ContentType;
  content: string;
  meta?: Record<string, unknown> | null;
  nextContent?: string | null;
  chain: AnswerChainItem[];
}

interface AnswerChainItem {
  id: string;
  contentType: ContentType;
  content: string;
  meta?: Record<string, unknown> | null;
  nextContent?: string | null;
}
```

Lưu ý về `chain`:

- `question.chain[0]` chính là node gốc tương ứng với `question.content`.
- `answer.chain[0]` chính là node gốc tương ứng với `answer.content`.
- Nếu render toàn bộ `chain`, không render thêm `content` ở object cha vì sẽ bị lặp.
- Backend hiện tải tối đa 10 node cho mỗi chain.

Với `MATCHING` và `ORDERING`, backend chủ động trả `answers: []`; dữ liệu tương tác của các loại này nằm trong content/meta của câu hỏi. Các loại còn lại trả answer options theo dữ liệu đề.

## 5. Ví dụ response đầy đủ

```json
{
  "success": true,
  "message": "Thành công",
  "data": {
    "attemptId": "a233abe3-1961-4af5-a482-542f1227d844",
    "status": "DOING",
    "startedAt": "2026-08-15T02:15:30.000Z",
    "studentId": "b233abe3-1961-4af5-a482-542f1227d844",
    "guestName": "Nguyễn Văn A",
    "questionBankId": "3233abe3-1961-4af5-a482-542f1227d844",
    "questionBankName": "English Practice Test",
    "examSetId": null,
    "examSetName": null,
    "examName": "English Practice Test",
    "groups": [
      {
        "sectionId": "c233abe3-1961-4af5-a482-542f1227d844",
        "title": "NHÓM Câu 1-2",
        "instruction": "Nghe và chọn đáp án đúng",
        "orderNo": 1,
        "meta": {
          "questionFormat": "LISTENING",
          "questionRange": { "from": 1, "to": 2 },
          "audio": {
            "label": "Audio 001",
            "fileId": "d233abe3-1961-4af5-a482-542f1227d844",
            "path": "/uploads/question-banks/3233abe3/audio-001.mp3",
            "originalName": "Audio 001.mp3",
            "mimetype": "audio/mpeg",
            "size": 125000
          }
        },
        "questions": [
          {
            "id": "e233abe3-1961-4af5-a482-542f1227d844",
            "orderNo": 1,
            "points": 1,
            "sectionId": "c233abe3-1961-4af5-a482-542f1227d844",
            "sectionTitle": "NHÓM Câu 1-2",
            "sectionInstruction": "Nghe và chọn đáp án đúng",
            "sectionOrderNo": 1,
            "type": "SINGLE_CHOICE",
            "contentType": "TEXT",
            "content": "She ____ to school every day.",
            "nextContent": null,
            "chain": [
              {
                "id": "e233abe3-1961-4af5-a482-542f1227d844",
                "type": "SINGLE_CHOICE",
                "contentType": "TEXT",
                "content": "She ____ to school every day.",
                "meta": null,
                "nextContent": null
              }
            ],
            "answers": [
              {
                "id": "f233abe3-1961-4af5-a482-542f1227d844",
                "contentType": "TEXT",
                "content": "goes",
                "meta": null,
                "nextContent": null,
                "chain": [
                  {
                    "id": "f233abe3-1961-4af5-a482-542f1227d844",
                    "contentType": "TEXT",
                    "content": "goes",
                    "meta": null,
                    "nextContent": null
                  }
                ]
              }
            ]
          }
        ]
      },
      {
        "sectionId": null,
        "title": null,
        "instruction": null,
        "orderNo": null,
        "meta": null,
        "questions": []
      }
    ]
  }
}
```

Group `sectionId: null` chỉ xuất hiện khi thực tế có câu chưa gán section; ví dụ trên để minh họa shape, còn production sẽ không trả group rỗng.

## 6. Render media

Các đường dẫn bắt đầu bằng `/uploads/...` là relative URL. FE cần ghép với origin backend, không ghép với origin frontend:

```ts
function resolveMediaUrl(path?: string | null) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return new URL(path, API_BASE_URL).toString();
}
```

Gợi ý render:

- `TEXT`: render text/markup theo convention hiện tại của app.
- `IMAGE`: `<img src={resolveMediaUrl(item.content)} />`.
- `AUDIO`: `<audio controls src={resolveMediaUrl(item.content)} />`.
- Audio dùng chung cho section: `<audio controls src={resolveMediaUrl(group.meta?.audio?.path)} />` và chỉ render một lần ở header group.

## 7. Luồng tích hợp đề xuất

1. Disable nút “Bắt đầu” ngay khi request được gửi.
2. Gọi đúng endpoint theo trạng thái đăng nhập/public.
3. Lưu `data.attemptId` ngay khi nhận response; đây là ID dùng để nộp bài.
4. Render trực tiếp `data.groups`; không cần gọi API section riêng và không cần tự group lại.
5. Dùng `question.id` và `answer.id` làm giá trị submit, không dùng index UI làm định danh.
6. Khi nộp:
   - đăng nhập: `POST /attempt/:attemptId/end`;
   - public: `POST /public-attempt/:attemptId/end`.
7. Nếu start lỗi hoặc timeout, re-enable nút. Không tự retry POST; hãy để người dùng xác nhận vì request trước có thể đã tạo attempt.

Ví dụ gọi API:

```ts
async function startGroupedAttempt(input: {
  questionBankId: string;
  examSetId?: string | null;
  guestName?: string;
  accessToken?: string;
}) {
  const isPublic = !input.accessToken;
  const endpoint = isPublic
    ? '/public-attempt/start-with-group'
    : '/attempt/start-with-group';

  const response = await api.post<ApiSuccess<StartGroupedAttemptResponse>>(
    endpoint,
    {
      questionBankId: input.questionBankId,
      examSetId: input.examSetId ?? null,
      ...(isPublic ? { guestName: input.guestName?.trim() } : {}),
    },
    isPublic
      ? undefined
      : { headers: { Authorization: `Bearer ${input.accessToken}` } },
  );

  return response.data.data;
}
```

## 8. Error response

Lỗi không dùng success wrapper:

```ts
interface ApiError {
  statusCode: number;
  message: string | string[];
  error: string;
  timestamp: string;
  path: string;
  method: string;
}
```

Ví dụ:

```json
{
  "statusCode": 400,
  "message": "Question bank không nằm trong exam set được chọn",
  "error": "Bad Request",
  "timestamp": "2026-08-15T02:15:30.000Z",
  "path": "/attempt/start-with-group",
  "method": "POST"
}
```

Các trường hợp FE nên xử lý:

| HTTP | Nguyên nhân thường gặp | Xử lý FE |
| --- | --- | --- |
| `400` | UUID/body sai, `guestName` rỗng, question bank không thuộc exam set | Hiện message, giữ form để sửa |
| `401` | Thiếu token, token sai/hết hạn | Đưa về luồng đăng nhập/refresh token |
| `403` | Token không phải role `STUDENT` | Chặn truy cập màn hình làm bài |
| `404` | Không có question bank/exam set; hoặc thiếu trường/lớp cấu hình ở luồng public | Hiện trạng thái không thể bắt đầu và cho thử lại sau |
| `500` | Lỗi hệ thống/dữ liệu | Không tự tạo attempt mới; cho người dùng chủ động thử lại |

Chuẩn hóa message trước khi hiển thị:

```ts
const message = Array.isArray(error.response?.data?.message)
  ? error.response.data.message.join(', ')
  : error.response?.data?.message ?? 'Không thể bắt đầu bài làm';
```

## 9. Kết quả review backend

Hai endpoint đã có controller, Swagger DTO, service grouping và unit test cho section metadata/audio. Contract hiện tại đủ để FE tích hợp, nhưng có các điểm cần lưu ý:

1. `/public-attempt/start-with-group` có `ValidationPipe`; `/attempt/start-with-group` hiện không có pipe validation ở controller và project cũng không đăng ký global validation pipe. FE vẫn phải validate UUID/body ở client; backend nên đồng bộ validation cho endpoint đăng nhập.
2. Attempt được lưu trước khi backend dựng xong question/groups. Nếu bước dựng payload lỗi, client nhận lỗi nhưng database có thể đã tồn tại attempt `DOING` (luồng public còn có user/student public). Vì vậy FE không nên tự retry POST.
3. Logic grouped tải danh sách liên kết question bank thêm một lần sau khi đã dựng questions. Đây là vấn đề hiệu năng backend, không làm thay đổi contract FE.
4. Answer options không trả `orderNo`. FE phải giữ thứ tự array backend trả về và submit UUID (`answerId`/`selectedAnswerIds`). Không nên dùng format rút gọn như `1A`/`2B` trong UI mới.
5. Việc sắp group theo section khiến group chưa gán section luôn ở cuối, dù câu của group đó có `question.orderNo` nhỏ hơn câu trong section.

## 10. Checklist FE

- [ ] Chọn endpoint theo luồng authenticated/public.
- [ ] Gửi Bearer token chỉ cho luồng authenticated; token phải là `STUDENT`.
- [ ] Trim và kiểm tra `guestName` từ 1 đến 150 ký tự ở luồng public.
- [ ] Disable nút start trong lúc request chạy; không auto-retry POST.
- [ ] Đọc payload từ `response.data.data`.
- [ ] Lưu `attemptId` trước khi chuyển màn hình.
- [ ] Render `groups`, kể cả group có `sectionId: null`.
- [ ] Không render lặp object cha và phần tử đầu của `chain`.
- [ ] Resolve `/uploads/...` bằng backend base URL.
- [ ] Render audio section từ `group.meta.audio.path` nếu có.
- [ ] Không đọc hoặc suy đoán `isCorrect` khi đang làm bài.
- [ ] Submit bằng UUID câu hỏi/đáp án, không dựa vào index hiển thị.
- [ ] Xử lý riêng `400`, `401`, `403`, `404` và lỗi không xác định.
