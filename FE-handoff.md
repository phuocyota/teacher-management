# FE Handoff: Báo cáo làm bài học sinh

Base path: `/report/attempt`

Xác thực:

- `Authorization: Bearer <teacher_token>`

Vai trò:

- `TEACHER`

## 1. Tổng quan API

| API                                        | Method | Mục đích                                            | Đầu vào                                                                  | Đầu ra chính                                                                                   |
| ------------------------------------------ | ------ | --------------------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `/report/attempt/groups`                   | `GET`  | Lấy danh sách nhóm mà giáo viên đang là trưởng nhóm | Không có                                                                 | Danh sách nhóm: `id`, `name`, `type`                                                           |
| `/report/attempt/groups/:groupId/students` | `GET`  | Lấy danh sách học sinh theo nhóm đã chọn            | Path param `groupId`                                                     | Danh sách học sinh: `id`, `fullName`, `userName`, `code`, `studentGroupId`, `studentGroupName` |
| `/report/attempt/student`                  | `GET`  | Lấy dữ liệu báo cáo của 1 học sinh                  | Query: `groupId`, `studentId`, `fromDate?`, `toDate?`, `page?`, `limit?` | `student`, `summary`, `trend`, `attempts`, `page`, `limit`, `total`                            |

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

| Trường      | Bắt buộc | Kiểu     | Ghi chú                |
| ----------- | -------- | -------- | ---------------------- |
| `groupId`   | Có       | `string` | UUID                   |
| `studentId` | Có       | `string` | UUID                   |
| `fromDate`  | Không    | `string` | Định dạng `YYYY-MM-DD` |
| `toDate`    | Không    | `string` | Định dạng `YYYY-MM-DD` |
| `page`      | Không    | `number` | Mặc định `1`           |
| `limit`     | Không    | `number` | Mặc định `10`          |

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

| Thành phần UI         | Nguồn dữ liệu                                  |
| --------------------- | ---------------------------------------------- |
| Combobox `Nhóm`       | `GET /report/attempt/groups`                   |
| Combobox `Học sinh`   | `GET /report/attempt/groups/:groupId/students` |
| `Tổng lần làm`        | `summary.totalAttempts`                        |
| `Điểm trung bình`     | `summary.averageScore`                         |
| `Điểm cao nhất`       | `summary.highestScore`                         |
| `Lần gần nhất`        | `summary.latestAttemptAt`                      |
| Tab `Xu hướng điểm`   | `trend[]`                                      |
| Tab `Lịch sử làm bài` | `attempts[]`                                   |
| Phân trang lịch sử    | `page`, `limit`, `total`                       |

## 4. Luồng gọi API đề xuất cho frontend

1. Khi vào màn hình, gọi `GET /report/attempt/groups`
2. Khi người dùng chọn nhóm, gọi `GET /report/attempt/groups/:groupId/students`
3. Khi người dùng chọn học sinh và khoảng ngày, gọi `GET /report/attempt/student`
4. Khi người dùng đổi trang ở tab lịch sử, gọi lại `GET /report/attempt/student` với `page` và `limit` mới

## 5. Lỗi thường gặp

| Mã HTTP | Trường hợp                                                                           |
| ------- | ------------------------------------------------------------------------------------ |
| `400`   | UUID không hợp lệ, ngày sai định dạng, `fromDate > toDate`, `page < 1`, `limit < 1`  |
| `403`   | Giáo viên không phải trưởng nhóm của nhóm đã chọn, hoặc token không hợp lệ           |
| `404`   | Không tìm thấy nhóm, không tìm thấy học sinh, hoặc học sinh không thuộc nhóm đã chọn |

## 6. Lưu ý cho frontend

- `averageScore`, `highestScore`, `latestAttemptAt`, `submittedAt`, `score` có thể là `null`
- `trend` có thể là mảng rỗng
- `attempts` có thể là mảng rỗng
- Backend yêu cầu định dạng ngày là `YYYY-MM-DD`
- Chức năng xuất Excel hiện chưa được implement ở backend

---

# FE Handoff: Random cau hoi trong ngan hang cau hoi

Base path: `/question-bank`

Xac thuc:

- `Authorization: Bearer <token>`

## 1. API random cau hoi

Endpoint:

```http
GET /question-bank/random/:questionBankId
Authorization: Bearer <token>
```

Muc dich:

- Lay ngau nhien 1 cau hoi trong ngan hang cau hoi.
- Backend tu luu cac cau hoi da random vao file `data/question-bank-random-history.json` de tranh tra lai cau hoi da lay.
- Van ho tro `excludeQuestionIds` neu FE muon loai tru them cac cau hoi dang giu trong state.

Danh sach param:

| Truong               | Vi tri | Bat buoc | Kieu     | Ghi chu                                                      |
| -------------------- | ------ | -------- | -------- | ------------------------------------------------------------ |
| `questionBankId`     | Path   | Co       | `string` | UUID ngan hang cau hoi                                       |
| `excludeQuestionIds` | Query  | Khong    | `string` | Danh sach `questionId` can loai tru, phan cach bang dau phay |

Vi du goi lan dau:

```http
GET /question-bank/random/3233abe3-1961-4af5-a482-542f1227d844
Authorization: Bearer <token>
```

Vi du goi lan tiep theo, tranh lay lai cac cau da co:

```http
GET /question-bank/random/3233abe3-1961-4af5-a482-542f1227d844?excludeQuestionIds=5233abe3-1961-4af5-a482-542f1227d844,6233abe3-1961-4af5-a482-542f1227d844
Authorization: Bearer <token>
```

Vi du response:

```json
{
  "id": "7233abe3-1961-4af5-a482-542f1227d844",
  "type": "SINGLE_CHOICE",
  "contentType": "TEXT",
  "content": "What is the capital of France?",
  "meta": null,
  "isRoot": true,
  "questionBankId": "3233abe3-1961-4af5-a482-542f1227d844",
  "nextContent": null,
  "nextContentDetails": null,
  "answers": [
    {
      "id": "8233abe3-1961-4af5-a482-542f1227d844",
      "orderNo": 1,
      "isCorrect": false,
      "contentType": "TEXT",
      "content": "London",
      "meta": null,
      "questionId": "7233abe3-1961-4af5-a482-542f1227d844",
      "nextContent": null,
      "nextContentDetails": null,
      "createdAt": "2026-05-11T01:00:00.000Z",
      "updatedAt": "2026-05-11T01:00:00.000Z"
    },
    {
      "id": "9233abe3-1961-4af5-a482-542f1227d844",
      "orderNo": 2,
      "isCorrect": true,
      "contentType": "TEXT",
      "content": "Paris",
      "meta": null,
      "questionId": "7233abe3-1961-4af5-a482-542f1227d844",
      "nextContent": null,
      "nextContentDetails": null,
      "createdAt": "2026-05-11T01:00:00.000Z",
      "updatedAt": "2026-05-11T01:00:00.000Z"
    }
  ],
  "createdAt": "2026-05-11T01:00:00.000Z",
  "updatedAt": "2026-05-11T01:00:00.000Z"
}
```

Luu y response:

- API tra ve thong tin cau hoi kem danh sach dap an trong field `answers`.
- Dap an duoc sap xep theo `orderNo` tang dan, neu trung `orderNo` thi theo `createdAt`.
- Neu cau hoi co chuoi noi dung tiep theo, field `nextContentDetails` se co thong tin node tiep theo.
- Neu dap an co chuoi noi dung tiep theo, field `answers[].nextContentDetails` se co thong tin node tiep theo.
- Backend chi random cac cau hoi root (`isRoot = true`) trong ngan hang cau hoi.
- Moi cau hoi da random se duoc ghi vao `data/question-bank-random-history.json` theo `questionBankId`.

## 2. Cach FE tranh trung lap

Backend da tu tranh trung lap bang file JSON, nen FE co the goi endpoint khong can gui `excludeQuestionIds`:

```ts
await api.get(`/question-bank/random/${questionBankId}`);
```

Neu FE van co state local va muon loai tru them, co the tiep tuc gui `excludeQuestionIds`:

```ts
const excludeQuestionIds = usedQuestionIds.join(',');

await api.get(`/question-bank/random/${questionBankId}`, {
  params: { excludeQuestionIds },
});
```

Khi tat ca cau hoi trong ngan hang da duoc random, backend tra `404`.
Muon bat dau lai vong random, xoa entry tuong ung trong file `data/question-bank-random-history.json` hoac xoa file nay de reset tat ca ngan hang cau hoi.

## 3. Xu ly loi

| Ma HTTP   | Truong hop                                                        | FE nen lam gi                                                |
| --------- | ----------------------------------------------------------------- | ------------------------------------------------------------ |
| `400`     | `questionBankId` hoac `excludeQuestionIds` khong phai UUID hop le | Kiem tra lai du lieu truoc khi goi API                       |
| `401/403` | Thieu token hoac token khong co quyen                             | Dieu huong dang nhap hoac hien thong bao het phien           |
| `404`     | Khong tim thay ngan hang cau hoi, hoac da het cau hoi chua dung   | Hien trang thai "Da het cau hoi" va dung nut "Cau tiep theo" |

## 4. Khuyen nghi neu can tranh trung lap ben vung

Cach dung `excludeQuestionIds` phu thuoc vao state FE. Neu reload trang, doi thiet bi, hoac can dam bao chong trung lap trong bai thi that, FE nen dung flow co `attemptId` de backend luu lich su cau hoi da phat.

Phuong an backend nen lam tiep:

- Tao bang/session luu `attemptId`, `questionId`, `servedAt`.
- API random nhan `attemptId` thay vi FE gui danh sach exclude.
- Backend tu loai cac cau da phat trong attempt do.

---

# FE Handoff: APPI xuat diem theo template-zone

Base path: `/report/attempt`

Xac thuc:

- `Authorization: Bearer <token>`

Vai tro:

- `ADMIN`
- `TEACHER`

Template backend dang dung:

- `templates/template-zone.xlsx`

## 1. API xuat file Excel thong ke khu vuc

Endpoint:

```http
GET /report/attempt/zones/:zoneId/export-zone-stat-sheet
Authorization: Bearer <token>
Accept: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
```

Muc dich:

- Xuat file Excel thong ke diem theo khu vuc.
- Moi dong trong file la thong ke tong hop theo truong trong khu vuc da chon.
- Backend doc template `templates/template-zone.xlsx`, ghi du lieu vao sheet template, sau do tra ve file `.xlsx`.

Danh sach param:

| Truong           | Vi tri | Bat buoc | Kieu     | Ghi chu                                    |
| ---------------- | ------ | -------- | -------- | ------------------------------------------ |
| `zoneId`         | Path   | Co       | `string` | UUID khu vuc                               |
| `examSetId`      | Query  | Khong    | `string` | UUID bo de, loc attempt theo bo de         |
| `questionBankId` | Query  | Khong    | `string` | UUID de thi/ngan hang cau hoi              |
| `fromDate`       | Query  | Khong    | `string` | Dinh dang `YYYY-MM-DD`, loc theo ngay lam  |
| `toDate`         | Query  | Khong    | `string` | Dinh dang `YYYY-MM-DD`, loc theo ngay lam  |

Vi du request:

```http
GET /report/attempt/zones/9233abe3-1961-4af5-a482-542f1227d844/export-zone-stat-sheet?questionBankId=a233abe3-1961-4af5-a482-542f1227d844&fromDate=2026-03-01&toDate=2026-03-31
Authorization: Bearer <token>
```

Response:

```http
200 OK
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="thong-ke-khu-vuc-<zoneCode>.xlsx"
```

Body la binary Excel file. FE can xu ly response dang `blob`/`arraybuffer`, khong parse JSON.

## 2. Mapping du lieu trong file Excel

Backend ghi du lieu tu dong bat dau o dong `9` cua sheet template.

| Cot Excel | Gia tri backend ghi                 | Ghi chu                                    |
| --------- | ----------------------------------- | ------------------------------------------ |
| `A`       | STT                                 | Bat dau tu `1`                             |
| `B`       | Rong                                | De trong theo template                     |
| `C`       | `schoolName`                        | Ten truong                                 |
| `D`       | Rong                                | De trong theo template                     |
| `E`       | `totalGroups`                       | Tong so lop/nhom trong truong             |
| `F`       | `attemptedGroups`                   | So lop co hoc sinh da lam bai             |
| `G`       | `absentGroups`                      | So lop chua co hoc sinh lam bai           |
| `H`       | `totalStudents`                     | Tong so hoc sinh                           |
| `I`       | `attemptedStudents`                 | So hoc sinh co attempt hop le              |
| `J`       | `absentStudents`                    | So hoc sinh chua lam                       |
| `K`       | `averageScore`                      | Diem trung binh, lam tron 2 chu so         |
| `L`       | `completionRate`                    | Ti le hoan thanh, don vi phan tram         |
| `M`       | `assessment`                        | Danh gia theo ti le hoan thanh             |
| `N`       | Rong                                | De trong theo template                     |

Header trong file:

- O `A4` gom ten ky thi, ten bang thong ke, ten tinh/thanh pho va chuong trinh.
- Neu template co sheet `data`, backend ghi ten khu vuc vao cell `data!B6`.

## 3. Cach goi tu frontend

Vi du voi Axios:

```ts
const response = await api.get(
  `/report/attempt/zones/${zoneId}/export-zone-stat-sheet`,
  {
    params: {
      examSetId,
      questionBankId,
      fromDate,
      toDate,
    },
    responseType: 'blob',
  },
);

const disposition = response.headers['content-disposition'];
const fileName =
  disposition?.match(/filename="([^"]+)"/)?.[1] ?? 'thong-ke-khu-vuc.xlsx';

const url = URL.createObjectURL(response.data);
const link = document.createElement('a');
link.href = url;
link.download = fileName;
link.click();
URL.revokeObjectURL(url);
```

## 4. Luong UI de xuat

1. Nguoi dung chon `Khu vuc`.
2. Nguoi dung tuy chon loc theo `Bo de`, `De thi/ngan hang cau hoi`, `Tu ngay`, `Den ngay`.
3. FE goi `GET /report/attempt/zones/:zoneId/export-zone-stat-sheet` voi cac filter dang co.
4. FE hien loading trong luc tai file va tat loading khi nhan duoc blob.
5. Neu thanh cong, trinh duyet tai file `thong-ke-khu-vuc-<zoneCode>.xlsx`.

## 5. Xu ly loi

| Ma HTTP   | Truong hop                                                           | FE nen lam gi                                      |
| --------- | -------------------------------------------------------------------- | -------------------------------------------------- |
| `400`     | `zoneId`, `examSetId`, `questionBankId` khong phai UUID hop le; ngay sai dinh dang; `fromDate > toDate` | Validate form truoc khi goi API                    |
| `401/403` | Thieu token, token het han, hoac user khong co quyen xem khu vuc nay | Dieu huong dang nhap hoac hien thong bao het phien |
| `404`     | Khong tim thay khu vuc                                               | Hien thong bao "Khong tim thay khu vuc"            |

## 6. Luu y cho FE

- API nay khong tra JSON khi thanh cong.
- Neu khong co du lieu, backend van tra file Excel theo template, phan bang du lieu se rong.
- `TEACHER` chi thay du lieu cua cac lop/truong ma giao vien co quyen truy cap theo backend.
- `fromDate` va `toDate` loc theo `attempt.started_at`.
- `averageScore` trong file duoc tinh theo attempt moi nhat cua tung hoc sinh trong pham vi filter.

---

# FE Handoff: Cap nhat response report attempt

Base path: `/report/attempt`

Cac API duoc bo sung field ten, lop, truong:

- `GET /report/attempt/groups`
- `GET /report/attempt/groups/:groupId/students`
- `GET /report/attempt/student`

## 1. `GET /report/attempt/groups`

Moi item tra them:

```json
{
  "id": "5233abe3-1961-4af5-a482-542f1227d844",
  "name": "THNVB - Lop 5A",
  "className": "Lop 5A",
  "schoolId": "a233abe3-1961-4af5-a482-542f1227d844",
  "schoolName": "TH Nguyen Van Bua",
  "shoolName": "TH Nguyen Van Bua",
  "schoolCode": "THNVB",
  "type": "CLASS"
}
```

Luu y:

- `name` van giu format cu de khong gay vo FE hien tai.
- FE co the dung truc tiep `className`, `shoolName`, `schoolName`, `schoolCode` neu can hien thi rieng lop/truong.
- `shoolName` la alias cua `schoolName` theo contract FE hien tai.

## 2. `GET /report/attempt/groups/:groupId/students`

Moi item hoc sinh tra them:

```json
{
  "id": "6233abe3-1961-4af5-a482-542f1227d844",
  "fullName": "Nguyen Van B",
  "studentName": "Nguyen Van B",
  "userName": "student_b",
  "code": "HS001",
  "studentGroupId": "7233abe3-1961-4af5-a482-542f1227d844",
  "studentGroupName": "Lop 5A",
  "classId": "7233abe3-1961-4af5-a482-542f1227d844",
  "className": "Lop 5A",
  "schoolId": "a233abe3-1961-4af5-a482-542f1227d844",
  "schoolName": "TH Nguyen Van Bua",
  "shoolName": "TH Nguyen Van Bua",
  "schoolCode": "THNVB"
}
```

Luu y:

- `classId` la alias cua `studentGroupId`.
- `className` la alias cua `studentGroupName`.
- `studentName` uu tien `fullName`, neu khong co thi dung `userName`.
- `shoolName` la alias cua `schoolName`.

## 3. `GET /report/attempt/student`

Response top-level tra them thong tin lop/truong dang loc:

```json
{
  "groupId": "7233abe3-1961-4af5-a482-542f1227d844",
  "groupName": "Lop 5A",
  "className": "Lop 5A",
  "schoolId": "a233abe3-1961-4af5-a482-542f1227d844",
  "schoolName": "TH Nguyen Van Bua",
  "shoolName": "TH Nguyen Van Bua",
  "schoolCode": "THNVB"
}
```

Field `student` tra cung format voi API danh sach hoc sinh o muc 2.

Moi item trong `attempts[]` tra them:

```json
{
  "studentId": "6233abe3-1961-4af5-a482-542f1227d844",
  "studentName": "Nguyen Van B",
  "studentCode": "HS001",
  "classId": "7233abe3-1961-4af5-a482-542f1227d844",
  "className": "Lop 5A",
  "schoolId": "a233abe3-1961-4af5-a482-542f1227d844",
  "schoolName": "TH Nguyen Van Bua",
  "shoolName": "TH Nguyen Van Bua",
  "schoolCode": "THNVB"
}
```

Luu y:

- Cac field lop/truong co the la `null` neu hoc sinh chua duoc gan lop/truong.
- Khi FE goi `studentId=all`, nen lay ten hoc sinh/lop/truong tu tung item trong `attempts[]`.
- FE can 3 field chinh thi doc `className`, `shoolName`, `studentName`.

---

# Luồng làm đề thi thử public

Base path: `/public-attempt`

Luồng này dành cho người dùng bên ngoài hệ thống. Người làm bài chỉ cần nhập tên và chọn đề thi, không cần đăng nhập và không gửi Bearer token.

## 1. Bắt đầu làm bài

```http
POST /public-attempt/start
Content-Type: application/json
```

Request:

```json
{
  "guestName": "Nguyễn Văn A",
  "questionBankId": "3233abe3-1961-4af5-a482-542f1227d844",
  "examSetId": "4233abe3-1961-4af5-a482-542f1227d844"
}
```

| Field            | Bắt buộc | Kiểu     | Ghi chú                                                        |
| ---------------- | -------- | -------- | -------------------------------------------------------------- |
| `guestName`      | Có       | `string` | Tên người làm bài, từ 1 đến 150 ký tự                           |
| `questionBankId` | Có       | `UUID`   | ID đề thi được chọn                                            |
| `examSetId`      | Không    | `UUID`   | ID bộ đề; nếu gửi thì đề thi phải thuộc đúng bộ đề này          |

Response `201`:

```json
{
  "success": true,
  "message": "Thành công",
  "data": {
    "attemptId": "9233abe3-1961-4af5-a482-542f1227d844",
    "status": "DOING",
    "startedAt": "2026-07-27T05:00:00.000Z",
    "studentId": "a233abe3-1961-4af5-a482-542f1227d844",
    "guestName": "Nguyễn Văn A",
    "questionBankId": "3233abe3-1961-4af5-a482-542f1227d844",
    "questionBankName": "Đề thi thử số 1",
    "examSetId": "4233abe3-1961-4af5-a482-542f1227d844",
    "examSetName": "Bộ đề thi thử",
    "examName": "Đề thi thử số 1",
    "questions": [
      {
        "id": "5233abe3-1961-4af5-a482-542f1227d844",
        "orderNo": 1,
        "points": 1,
        "type": "SINGLE_CHOICE",
        "contentType": "TEXT",
        "content": "Nội dung câu hỏi",
        "nextContent": null,
        "chain": [
          {
            "id": "5233abe3-1961-4af5-a482-542f1227d844",
            "type": "SINGLE_CHOICE",
            "contentType": "TEXT",
            "content": "Nội dung câu hỏi",
            "nextContent": null
          }
        ],
        "answers": [
          {
            "id": "6233abe3-1961-4af5-a482-542f1227d844",
            "contentType": "TEXT",
            "content": "Đáp án A",
            "nextContent": null,
            "chain": [
              {
                "id": "6233abe3-1961-4af5-a482-542f1227d844",
                "contentType": "TEXT",
                "content": "Đáp án A",
                "nextContent": null
              }
            ]
          }
        ]
      }
    ]
  }
}
```

Lưu ý:

- Response câu hỏi không trả field `isCorrect`.
- FE phải lưu `data.attemptId` để dùng khi nộp bài.
- `examSetId`, `examSetName` có thể là `null`.
- Nếu người dùng nhập tên có khoảng trắng ở đầu hoặc cuối, backend sẽ tự loại bỏ.
- `guestName` được lưu làm họ tên học sinh. Backend tự tạo học sinh thuộc lớp `test tiếng anh đầu vào` của trường `Di-ichi` và trả ID tại `studentId`.
- Mỗi lần gọi API start sẽ tạo một học sinh mới; backend không gộp theo họ tên vì nhiều học sinh có thể trùng tên.

## 2. Nộp bài

```http
POST /public-attempt/:attemptId/end
Content-Type: application/json
```

Có thể gửi theo format ngắn:

```json
{
  "answers": ["1A", "2B", "3C"]
}
```

Trong đó `1A` nghĩa là câu có `orderNo = 1` chọn đáp án A.

Hoặc gửi format đầy đủ:

```json
{
  "answers": [
    {
      "questionId": "5233abe3-1961-4af5-a482-542f1227d844",
      "answerId": "6233abe3-1961-4af5-a482-542f1227d844",
      "timeSpentSec": 45
    },
    {
      "questionId": "7233abe3-1961-4af5-a482-542f1227d844",
      "selectedAnswerIds": [
        "8233abe3-1961-4af5-a482-542f1227d844",
        "9233abe3-1961-4af5-a482-542f1227d844"
      ],
      "timeSpentSec": 60
    },
    {
      "questionId": "a233abe3-1961-4af5-a482-542f1227d844",
      "textValue": "Nội dung trả lời tự luận",
      "description": "Ghi chú thêm",
      "timeSpentSec": 90
    }
  ]
}
```

Response `200`:

```json
{
  "success": true,
  "message": "Thành công",
  "data": {
    "attemptId": "9233abe3-1961-4af5-a482-542f1227d844",
    "status": "SUBMITTED",
    "submittedAt": "2026-07-27T05:30:00.000Z",
    "score": 8,
    "totalQuestions": 10,
    "answeredQuestions": 9
  }
}
```

Lưu ý:

- Chỉ nộp được lượt public có `status = DOING`.
- Một `attemptId` chỉ nộp thành công một lần.
- `answerId` và `selectedAnswerIds` phải thuộc đúng `questionId`.
- Có thể gửi `{ "answers": [] }` khi hết giờ mà người dùng chưa trả lời câu nào.

## 3. Luồng tích hợp FE đề xuất

1. Hiển thị form nhập `guestName` và chọn đề thi.
2. Gọi `POST /public-attempt/start`.
3. Lưu `attemptId`, `startedAt` và danh sách `questions` vào state.
4. Render câu hỏi theo `orderNo`; lưu lựa chọn bằng `questionId` và `answerId`.
5. Khi người dùng bấm nộp hoặc hết thời gian, gọi `POST /public-attempt/:attemptId/end`.
6. Sau khi nộp thành công, khóa nút nộp và hiển thị `score`.

Ví dụ:

```ts
const startResponse = await api.post('/public-attempt/start', {
  guestName,
  questionBankId,
  examSetId: examSetId || undefined,
});

const attempt = startResponse.data.data;

const endResponse = await api.post(
  `/public-attempt/${attempt.attemptId}/end`,
  {
    answers,
  },
);

const result = endResponse.data.data;
```

Không thêm header `Authorization` cho hai request trên.

## 4. Xử lý lỗi

| HTTP status | Trường hợp thường gặp                                               | FE xử lý đề xuất                                      |
| ----------- | ------------------------------------------------------------------ | ----------------------------------------------------- |
| `400`       | Tên trống/quá dài, UUID sai, đề không thuộc bộ đề, đáp án sai mapping | Hiển thị `message`, giữ dữ liệu form để người dùng sửa |
| `403`       | `attemptId` không phải lượt public đang làm hoặc bài đã được nộp   | Khóa nút nộp, yêu cầu bắt đầu lượt mới                |
| `404`       | Không tìm thấy đề thi hoặc bộ đề                                   | Quay lại màn hình chọn đề                             |

Format lỗi:

```json
{
  "statusCode": 400,
  "message": "Nội dung lỗi",
  "error": "Bad Request",
  "timestamp": "2026-07-27T05:00:00.000Z",
  "path": "/public-attempt/start",
  "method": "POST"
}
```

## 5. CORS

Nếu trang thi thử được chạy từ một domain mới, domain đó phải được backend thêm vào danh sách CORS. Việc API không yêu cầu token không đồng nghĩa trình duyệt tự bỏ qua kiểm tra CORS.

---

# FE Handoff: Section trong ngân hàng câu hỏi

Section biểu diễn các phần của đề, ví dụ `PART I: VOCABULARY`, `PART II: GRAMMAR`.

Section là optional:

- Đề không chia phần: `sections = []`, mọi `questions[].sectionId = null`; FE giữ UI cũ.
- Đề có chia phần: câu thuộc phần có `sectionId`.
- Một đề có thể chứa cả câu có section và câu không có section.
- `questions` phẳng vẫn được giữ trong response để tương thích ngược.
- Xóa section không xóa câu; `sectionId` của câu được chuyển thành `null`.

## 1. TypeScript model

```ts
interface QuestionBankSection {
  id: string;
  questionBankId: string;
  title: string;
  instruction: string | null;
  orderNo: number;
  meta: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

interface QuestionBankQuestion {
  id: string;
  questionBankId: string;
  sectionId: string | null;
  content: string;
  contentType: 'TEXT' | 'IMAGE';
  orderNo: number;
  point: number;
  type:
    | 'SINGLE_CHOICE'
    | 'MULTIPLE_CHOICE'
    | 'TEXT_INPUT'
    | 'MATCHING'
    | 'ORDERING';
  answers: QuestionBankAnswer[];
}

interface QuestionBankSectionWithQuestions {
  id: string;
  title: string;
  instruction: string | null;
  orderNo: number;
  meta: Record<string, unknown> | null;
  questions: QuestionBankQuestion[];
}
```

## 2. API CRUD section

Base path:

```text
/question-bank-section
```

Các API này yêu cầu:

```http
Authorization: Bearer <token>
```

### 2.1 Tạo section

```http
POST /question-bank-section
Content-Type: application/json
```

```json
{
  "questionBankId": "3233abe3-1961-4af5-a482-542f1227d844",
  "title": "PART I: VOCABULARY",
  "instruction": "Choose the best answer.",
  "orderNo": 1,
  "meta": {
    "source": "manual"
  }
}
```

| Field            | Bắt buộc | Kiểu     | Ghi chú                                      |
| ---------------- | -------- | -------- | -------------------------------------------- |
| `questionBankId` | Có       | UUID     | ID ngân hàng câu hỏi                         |
| `title`          | Có       | string   | Tối đa 255 ký tự                             |
| `instruction`    | Không    | string   | Hướng dẫn hoặc nội dung chung của phần      |
| `orderNo`        | Có       | integer  | Từ 1, không trùng trong cùng question bank  |
| `meta`           | Không    | object   | Metadata mở rộng                             |

Response:

```json
{
  "success": true,
  "message": "Thành công",
  "data": {
    "id": "4233abe3-1961-4af5-a482-542f1227d844",
    "questionBankId": "3233abe3-1961-4af5-a482-542f1227d844",
    "title": "PART I: VOCABULARY",
    "instruction": "Choose the best answer.",
    "orderNo": 1,
    "meta": {
      "source": "manual"
    },
    "createdAt": "2026-07-27T07:00:00.000Z",
    "updatedAt": "2026-07-27T07:00:00.000Z"
  }
}
```

### 2.2 Danh sách section của đề

```http
GET /question-bank-section?questionBankId=:questionBankId
```

`data` là mảng được sắp xếp tăng dần theo `orderNo`.

### 2.3 Chi tiết section

```http
GET /question-bank-section/:sectionId
```

### 2.4 Cập nhật section

```http
PATCH /question-bank-section/:sectionId
Content-Type: application/json
```

Chỉ gửi field thay đổi:

```json
{
  "title": "PART I: VOCABULARY AND PRONUNCIATION",
  "instruction": "Choose one correct answer.",
  "orderNo": 1,
  "meta": {
    "color": "#2563EB"
  }
}
```

Không gửi `questionBankId` khi sửa. Backend không cho chuyển section sang question bank khác.

### 2.5 Xóa section

```http
DELETE /question-bank-section/:sectionId
```

Câu hỏi không bị xóa; các câu của section đó trở thành câu không có section.

## 3. Gắn section vào câu hỏi

`sectionId` không bắt buộc.

### Thêm câu vào question bank

```http
POST /question-bank/:questionBankId/questions
Content-Type: application/json
```

Có section:

```json
{
  "questionId": "5233abe3-1961-4af5-a482-542f1227d844",
  "sectionId": "4233abe3-1961-4af5-a482-542f1227d844",
  "orderNo": 1,
  "points": 0.5
}
```

Không có section:

```json
{
  "questionId": "5233abe3-1961-4af5-a482-542f1227d844",
  "orderNo": 1,
  "points": 0.5
}
```

Backend kiểm tra section phải thuộc đúng `questionBankId`.

### Cập nhật liên kết câu hỏi

```http
PATCH /question-bank-question/:questionBankQuestionId
Content-Type: application/json
```

Gắn section:

```json
{
  "sectionId": "4233abe3-1961-4af5-a482-542f1227d844"
}
```

Bỏ khỏi section:

```json
{
  "sectionId": null
}
```

## 4. Response chi tiết question bank

```http
GET /question-bank/:questionBankId/questions
```

Endpoint này vẫn public như trước. Response trả cả danh sách phẳng và danh sách đã group:

```json
{
  "success": true,
  "message": "Thành công",
  "data": {
    "id": "3233abe3-1961-4af5-a482-542f1227d844",
    "code": "QB-1001",
    "name": "English Practice Test",
    "questions": [
      {
        "id": "5233abe3-1961-4af5-a482-542f1227d844",
        "questionBankId": "3233abe3-1961-4af5-a482-542f1227d844",
        "sectionId": "4233abe3-1961-4af5-a482-542f1227d844",
        "content": "My mother bought me a new ________.",
        "contentType": "TEXT",
        "orderNo": 1,
        "point": 0.5,
        "type": "SINGLE_CHOICE",
        "answers": []
      },
      {
        "id": "6233abe3-1961-4af5-a482-542f1227d844",
        "questionBankId": "3233abe3-1961-4af5-a482-542f1227d844",
        "sectionId": null,
        "content": "Câu hỏi không thuộc phần.",
        "contentType": "TEXT",
        "orderNo": 2,
        "point": 0.5,
        "type": "SINGLE_CHOICE",
        "answers": []
      }
    ],
    "sections": [
      {
        "id": "4233abe3-1961-4af5-a482-542f1227d844",
        "title": "PART I: VOCABULARY",
        "instruction": "Choose the best answer.",
        "orderNo": 1,
        "meta": null,
        "questions": [
          {
            "id": "5233abe3-1961-4af5-a482-542f1227d844",
            "questionBankId": "3233abe3-1961-4af5-a482-542f1227d844",
            "sectionId": "4233abe3-1961-4af5-a482-542f1227d844",
            "content": "My mother bought me a new ________.",
            "contentType": "TEXT",
            "orderNo": 1,
            "point": 0.5,
            "type": "SINGLE_CHOICE",
            "answers": []
          }
        ]
      }
    ]
  }
}
```

FE nên:

- Dùng `data.sections` để render phần.
- Dùng `data.questions` để tìm các câu không có section.
- Sắp xếp section theo `section.orderNo`.
- Sắp xếp câu theo `question.orderNo`.

Ví dụ:

```ts
const detail = response.data.data;

const sectionedQuestionIds = new Set(
  detail.sections.flatMap((section) =>
    section.questions.map((question) => question.id),
  ),
);

const unsectionedQuestions = detail.questions.filter(
  (question) => !sectionedQuestionIds.has(question.id),
);

const sortedSections = [...detail.sections]
  .sort((a, b) => a.orderNo - b.orderNo)
  .map((section) => ({
    ...section,
    questions: [...section.questions].sort(
      (a, b) => a.orderNo - b.orderNo,
    ),
  }));
```

## 5. Response bắt đầu làm bài

Áp dụng cho:

```http
POST /attempt/start
POST /public-attempt/start
```

Mỗi item trong `data.questions` có thêm:

```ts
sectionId: string | null;
sectionTitle: string | null;
sectionInstruction: string | null;
sectionOrderNo: number | null;
```

Câu có section:

```json
{
  "id": "5233abe3-1961-4af5-a482-542f1227d844",
  "orderNo": 1,
  "points": 0.5,
  "sectionId": "4233abe3-1961-4af5-a482-542f1227d844",
  "sectionTitle": "PART I: VOCABULARY",
  "sectionInstruction": "Choose the best answer.",
  "sectionOrderNo": 1,
  "type": "SINGLE_CHOICE",
  "contentType": "TEXT",
  "content": "My mother bought me a new ________.",
  "chain": [],
  "answers": []
}
```

Câu không có section:

```json
{
  "id": "6233abe3-1961-4af5-a482-542f1227d844",
  "orderNo": 2,
  "points": 0.5,
  "sectionId": null,
  "sectionTitle": null,
  "sectionInstruction": null,
  "sectionOrderNo": null,
  "type": "SINGLE_CHOICE",
  "contentType": "TEXT",
  "content": "Câu hỏi không thuộc phần.",
  "chain": [],
  "answers": []
}
```

FE không cần gọi API section riêng trong lúc làm bài.

Logic tương thích:

```ts
const hasSection = questions.some((question) => question.sectionId);

if (!hasSection) {
  // Render UI danh sách câu hỏi hiện tại.
} else {
  // Group theo sectionId; các câu sectionId = null đưa vào nhóm riêng.
}
```

## 6. Import PDF

Endpoint không đổi:

```http
POST /question-bank/:questionBankId/import-pdf
Content-Type: multipart/form-data
Authorization: Bearer <token>
```

Backend:

- Nhận diện `PART I`, `PART II`, `PART III`, `PART IV` và `PHẦN I`, `PHẦN II`...
- Tự tạo/cập nhật section theo số phần.
- Gắn các câu sau tiêu đề phần vào section tương ứng.
- Không tạo section nếu file không có PART/PHẦN.
- Câu trước PART đầu tiên có `sectionId = null`.
- Nhận đáp án dạng `1.A`, `Question 1: A` hoặc danh sách tuần tự chỉ gồm `A`, `B`, `C`, `D`.

Hiện tại endpoint chỉ nhận PDF, chưa nhận trực tiếp DOCX.

## 7. Lỗi cần xử lý

| HTTP     | Trường hợp                                           | FE xử lý đề xuất                         |
| -------- | ---------------------------------------------------- | ---------------------------------------- |
| `400`    | Trùng `orderNo` trong cùng question bank            | Yêu cầu chọn thứ tự khác                 |
| `400`    | Section không thuộc đúng question bank              | Reload section theo `questionBankId`     |
| `400`    | Cố chuyển section sang question bank khác           | Không gửi `questionBankId` khi PATCH     |
| `400`    | UUID hoặc request không hợp lệ                      | Hiển thị `message` từ backend            |
| `404`    | Không tìm thấy section hoặc question bank           | Reload dữ liệu hoặc quay lại danh sách   |
| `401/403`| Thiếu token hoặc không có quyền                     | Yêu cầu đăng nhập lại                    |

## 8. Checklist FE

- [ ] Thêm model `QuestionBankSection`.
- [ ] Thêm `sectionId?: string | null` vào model liên kết câu hỏi.
- [ ] Màn hình chi tiết đề đọc thêm `data.sections`.
- [ ] Form thêm/sửa câu cho chọn section nhưng không bắt buộc.
- [ ] Có lựa chọn “Không thuộc phần”, gửi `sectionId: null`.
- [ ] Màn hình làm bài hiển thị `sectionTitle` và `sectionInstruction`.
- [ ] Nếu tất cả `sectionId = null`, tiếp tục dùng UI cũ.
- [ ] Không đọc `isCorrect` từ response bắt đầu làm bài.

---

# FE Handoff: API Phân công & Gỡ bài giảng hàng loạt (Lecture Bulk Assignment & Exclusion)

Tài liệu này hướng dẫn tích hợp các API phân công bài giảng hàng loạt (`bulk`) và gỡ phân công bài giảng hàng loạt (`bulk/exclude`) cho nhóm (`group`) và người dùng (`user`).

Xác thực:
- `Authorization: Bearer <token>`

---

## 1. Phân công & Gỡ phân công bài giảng cho Nhóm (`/lecture/group`)

Base Path: `/lecture/group`

### 1.1. Phân công nhiều bài giảng cho nhiều nhóm (`POST /lecture/group/bulk`)

Gán cùng lúc danh sách bài giảng cho danh sách các nhóm.

- **Endpoint**: `POST /lecture/group/bulk`
- **Header**: `Authorization: Bearer <token>`
- **Content-Type**: `application/json`

**Request Body**:
```json
{
  "lectureIds": [
    "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "b2c3d4e5-f6g7-8901-bcde-fg2345678901"
  ],
  "groupIds": [
    "c3d4e5f6-g7h8-9012-cdef-gh3456789012",
    "d4e5f6g7-h8i9-0123-defg-hi4567890123"
  ]
}
```

**Response (`201 Created`)**:
```json
{
  "statusCode": 201,
  "message": "All lecture-group relations created successfully"
}
```

---

### 1.2. Gỡ phân công nhiều bài giảng khỏi nhiều nhóm (`POST /lecture/group/bulk/exclude`)

Hủy gán danh sách bài giảng khỏi danh sách các nhóm đã chọn.

- **Endpoint**: `POST /lecture/group/bulk/exclude`
- **Header**: `Authorization: Bearer <token>`
- **Content-Type**: `application/json`

**Request Body**:
```json
{
  "groupIds": [
    "c3d4e5f6-a7b8-4012-cdef-ab3456789012",
    "d4e5f6a7-b8c9-4123-defa-bc4567890123"
  ],
  "lectureIds": [
    "a1b2c3d4-e5f6-4890-abcd-ef1234567890",
    "b2c3d4e5-f6a7-4901-bcde-fa2345678901"
  ]
}
```

| Trường | Bắt buộc | Kiểu | Mô tả |
| --- | --- | --- | --- |
| `groupIds` | Có | `string[]` | Danh sách UUID của nhóm cần gỡ bài giảng (không được rỗng) |
| `lectureIds` | Có | `string[]` | Danh sách UUID của bài giảng cần gỡ khỏi nhóm (không được rỗng) |

**Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Gỡ phân công bài giảng thành công",
  "data": {
    "deletedCount": 2
  }
}
```

---

## 2. Phân công & Gỡ phân công bài giảng cho Người dùng (`/lecture/user`)

Base Path: `/lecture/user`

### 2.1. Phân công nhiều bài giảng cho nhiều người dùng (`POST /lecture/user/bulk`)

- **Endpoint**: `POST /lecture/user/bulk`
- **Header**: `Authorization: Bearer <token>`
- **Content-Type**: `application/json`

**Request Body**:
```json
{
  "lectureIds": [
    "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "b2c3d4e5-f6g7-8901-bcde-fg2345678901"
  ],
  "userIds": [
    "c3d4e5f6-g7h8-9012-cdef-gh3456789012",
    "d4e5f6g7-h8i9-0123-defg-hi4567890123"
  ]
}
```

**Response (`201 Created`)**:
```json
{
  "statusCode": 201,
  "message": "All lecture-user relations created successfully"
}
```

---

### 2.2. Gỡ phân công nhiều bài giảng khỏi nhiều người dùng (`POST /lecture/user/bulk/exclude`)

Hủy gán danh sách bài giảng khỏi danh sách các người dùng đã chọn.

- **Endpoint**: `POST /lecture/user/bulk/exclude`
- **Header**: `Authorization: Bearer <token>`
- **Content-Type**: `application/json`

**Request Body**:
```json
{
  "userIds": [
    "c3d4e5f6-a7b8-4012-cdef-ab3456789012",
    "d4e5f6a7-b8c9-4123-defa-bc4567890123"
  ],
  "lectureIds": [
    "a1b2c3d4-e5f6-4890-abcd-ef1234567890",
    "b2c3d4e5-f6a7-4901-bcde-fa2345678901"
  ]
}
```

| Trường | Bắt buộc | Kiểu | Mô tả |
| --- | --- | --- | --- |
| `userIds` | Có | `string[]` | Danh sách UUID của người dùng cần gỡ bài giảng (không được rỗng) |
| `lectureIds` | Có | `string[]` | Danh sách UUID của bài giảng cần gỡ (không được rỗng) |

**Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Gỡ phân công bài giảng thành công",
  "data": {
    "deletedCount": 2
  }
}
```

---

## 3. Xử lý lỗi (Error Responses)

| Mã HTTP | Nguyên nhân | Xử lý FE đề xuất |
| --- | --- | --- |
| `400 Bad Request` | `groupIds`, `userIds` hoặc `lectureIds` rỗng, không phải mảng, hoặc chứa phần tử không phải UUID hợp lệ | Check frontend validation trước khi gửi request |
| `401 Unauthorized` | Thiếu token hoặc token hết hạn | Chuyển hướng người dùng sang trang đăng nhập |
| `403 Forbidden` | Người dùng không đủ thẩm quyền | Hạn chế thao tác trên UI |

