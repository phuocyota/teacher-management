# FE Handoff: Báo cáo làm bài học sinh

Base path: `/report/attempt`

Xác thực:
- `Authorization: Bearer <teacher_token>`

Vai trò:
- `TEACHER`

## 1. Tổng quan API

| API | Method | Mục đích | Đầu vào | Đầu ra chính |
| --- | --- | --- | --- | --- |
| `/report/attempt/groups` | `GET` | Lấy danh sách nhóm mà giáo viên đang là trưởng nhóm | Không có | Danh sách nhóm: `id`, `name`, `type` |
| `/report/attempt/groups/:groupId/students` | `GET` | Lấy danh sách học sinh theo nhóm đã chọn | Path param `groupId` | Danh sách học sinh: `id`, `fullName`, `userName`, `code`, `studentGroupId`, `studentGroupName` |
| `/report/attempt/student` | `GET` | Lấy dữ liệu báo cáo của 1 học sinh | Query: `groupId`, `studentId`, `fromDate?`, `toDate?`, `page?`, `limit?` | `student`, `summary`, `trend`, `attempts`, `page`, `limit`, `total` |

## 2. Chi tiết API

### 2.1 Lấy danh sách nhóm

Endpoint:

```http
GET /report/attempt/groups
Authorization: Bearer <token>
```

Ví dụ response:

```json
[
  {
    "id": "5233abe3-1961-4af5-a482-542f1227d844",
    "name": "Khoi 5A",
    "type": "PERSONAL"
  },
  {
    "id": "6233abe3-1961-4af5-a482-542f1227d845",
    "name": "Khoi 5B",
    "type": "PERSONAL"
  }
]
```

Frontend sử dụng:
- Đổ dữ liệu cho combobox `Nhóm`

### 2.2 Lấy danh sách học sinh theo nhóm

Endpoint:

```http
GET /report/attempt/groups/5233abe3-1961-4af5-a482-542f1227d844/students
Authorization: Bearer <token>
```

Ví dụ response:

```json
[
  {
    "id": "7233abe3-1961-4af5-a482-542f1227d844",
    "fullName": "Nguyen Van B",
    "userName": "student_b",
    "code": "HS001",
    "studentGroupId": "8233abe3-1961-4af5-a482-542f1227d844",
    "studentGroupName": "Lop 5A"
  },
  {
    "id": "7233abe3-1961-4af5-a482-542f1227d845",
    "fullName": "Tran Thi C",
    "userName": "student_c",
    "code": "HS002",
    "studentGroupId": "8233abe3-1961-4af5-a482-542f1227d844",
    "studentGroupName": "Lop 5A"
  }
]
```

Frontend sử dụng:
- Đổ dữ liệu cho combobox `Học sinh` sau khi người dùng chọn nhóm

### 2.3 Lấy báo cáo học sinh

Endpoint:

```http
GET /report/attempt/student?groupId=5233abe3-1961-4af5-a482-542f1227d844&studentId=7233abe3-1961-4af5-a482-542f1227d844&fromDate=2026-03-07&toDate=2026-04-06&page=1&limit=10
Authorization: Bearer <token>
```

Danh sách query param:

| Trường | Bắt buộc | Kiểu | Ghi chú |
| --- | --- | --- | --- |
| `groupId` | Có | `string` | UUID |
| `studentId` | Có | `string` | UUID |
| `fromDate` | Không | `string` | Định dạng `YYYY-MM-DD` |
| `toDate` | Không | `string` | Định dạng `YYYY-MM-DD` |
| `page` | Không | `number` | Mặc định `1` |
| `limit` | Không | `number` | Mặc định `10` |

Ví dụ response:

```json
{
  "groupId": "5233abe3-1961-4af5-a482-542f1227d844",
  "student": {
    "id": "7233abe3-1961-4af5-a482-542f1227d844",
    "fullName": "Nguyen Van B",
    "userName": "student_b",
    "code": "HS001",
    "studentGroupId": "8233abe3-1961-4af5-a482-542f1227d844",
    "studentGroupName": "Lop 5A"
  },
  "fromDate": "2026-03-07",
  "toDate": "2026-04-06",
  "summary": {
    "totalAttempts": 12,
    "averageScore": 7.8,
    "highestScore": 9.5,
    "latestAttemptAt": "2026-04-05T09:30:00.000Z"
  },
  "trend": [
    {
      "date": "2026-03-20",
      "attemptCount": 2,
      "averageScore": 7.5,
      "highestScore": 8.0
    },
    {
      "date": "2026-03-28",
      "attemptCount": 1,
      "averageScore": 9.5,
      "highestScore": 9.5
    }
  ],
  "attempts": [
    {
      "attemptId": "9233abe3-1961-4af5-a482-542f1227d844",
      "questionBankId": "a233abe3-1961-4af5-a482-542f1227d844",
      "questionBankName": "De thi hoc ky 1",
      "examSetId": "b233abe3-1961-4af5-a482-542f1227d844",
      "examSetName": "Bo de tuan 1",
      "status": "SUBMITTED",
      "startedAt": "2026-04-05T09:00:00.000Z",
      "submittedAt": "2026-04-05T09:30:00.000Z",
      "score": 8.5
    },
    {
      "attemptId": "9233abe3-1961-4af5-a482-542f1227d845",
      "questionBankId": "a233abe3-1961-4af5-a482-542f1227d845",
      "questionBankName": "De kiem tra chuong 3",
      "examSetId": "b233abe3-1961-4af5-a482-542f1227d845",
      "examSetName": "Bo de A",
      "status": "SUBMITTED",
      "startedAt": "2026-04-01T08:00:00.000Z",
      "submittedAt": "2026-04-01T08:25:00.000Z",
      "score": 7.0
    }
  ],
  "page": 1,
  "limit": 10,
  "total": 12
}
```

## 3. Mapping dữ liệu ra UI

| Thành phần UI | Nguồn dữ liệu |
| --- | --- |
| Combobox `Nhóm` | `GET /report/attempt/groups` |
| Combobox `Học sinh` | `GET /report/attempt/groups/:groupId/students` |
| `Tổng lần làm` | `summary.totalAttempts` |
| `Điểm trung bình` | `summary.averageScore` |
| `Điểm cao nhất` | `summary.highestScore` |
| `Lần gần nhất` | `summary.latestAttemptAt` |
| Tab `Xu hướng điểm` | `trend[]` |
| Tab `Lịch sử làm bài` | `attempts[]` |
| Phân trang lịch sử | `page`, `limit`, `total` |

## 4. Luồng gọi API đề xuất cho frontend

1. Khi vào màn hình, gọi `GET /report/attempt/groups`
2. Khi người dùng chọn nhóm, gọi `GET /report/attempt/groups/:groupId/students`
3. Khi người dùng chọn học sinh và khoảng ngày, gọi `GET /report/attempt/student`
4. Khi người dùng đổi trang ở tab lịch sử, gọi lại `GET /report/attempt/student` với `page` và `limit` mới

## 5. Lỗi thường gặp

| Mã HTTP | Trường hợp |
| --- | --- |
| `400` | UUID không hợp lệ, ngày sai định dạng, `fromDate > toDate`, `page < 1`, `limit < 1` |
| `403` | Giáo viên không phải trưởng nhóm của nhóm đã chọn, hoặc token không hợp lệ |
| `404` | Không tìm thấy nhóm, không tìm thấy học sinh, hoặc học sinh không thuộc nhóm đã chọn |

## 6. Lưu ý cho frontend

- `averageScore`, `highestScore`, `latestAttemptAt`, `submittedAt`, `score` có thể là `null`
- `trend` có thể là mảng rỗng
- `attempts` có thể là mảng rỗng
- Backend yêu cầu định dạng ngày là `YYYY-MM-DD`
- Chức năng xuất Excel hiện chưa được implement ở backend
