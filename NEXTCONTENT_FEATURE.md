# Tính năng NextContent - Câu hỏi và Câu trả lời xen kẽ Text và Hình ảnh

## Tổng quan

Tính năng `nextContent` cho phép tạo chuỗi các phần nội dung (content chain) trong câu hỏi và câu trả lời, hỗ trợ text và hình ảnh xen kẽ nhau.

## Cấu trúc dữ liệu

### Ví dụ câu hỏi xen kẽ

```
id | content                      | contentType | nextContent
01 | Hãy so sánh ảnh              | Text        | 02
02 | anh1.png                     | Image       | 03
03 | và ảnh                       | Text        | 04
04 | anh2.png                     | Image       | 05
05 | khác nhau như thế nào?       | Text        | null
```

### Ví dụ câu trả lời xen kẽ

```
id | content                      | contentType | nextContent | questionId
A1 | Khác nhau về                 | Text        | A2          | 05
A2 | mau_sac.png                  | Image       | A3          | 05
A3 | và kích thước                | Text        | null        | 05

B1 | Giống nhau                   | Text        | null        | 05
```

## Các thay đổi chính

### 1. Entity và DTO

- **QuestionEntity**: Đã có field `nextContent` để lưu ID của phần nội dung kế tiếp
- **QuestionResponseDto**: Thêm `nextContentDetails` để hiển thị thông tin chi tiết của nextContent
- **ParsedQuestion**: Thêm `contentParts[]` để lưu các phần content khi parse PDF
- **AnswerEntity**: Đã có field `nextContent` để lưu ID của phần nội dung kế tiếp
- **AnswerResponseDto**: Thêm `nextContentDetails` để hiển thị thông tin chi tiết của nextContent
- **ParsedAnswer**: Thêm `answerParts[]` để lưu các phần content khi parse PDF

### 2. Import từ PDF

#### Logic parse

Khi import câu hỏi từ file PDF, hệ thống sẽ:

1. Phát hiện các marker ảnh trong câu hỏi: `[IMG]`, `(hình)`, `[ảnh]`, `[image]`
2. Phát hiện các marker ảnh trong câu trả lời: `[IMG]`, `(hình)`, `[ảnh]`, `[image]`
3. Tách câu hỏi và câu trả lời thành các phần content (contentParts/answerParts)
4. Tạo chuỗi các Question và Answer entities liên kết bằng `nextContent`

#### Ví dụ input PDF

```
Câu 1: Hãy so sánh [IMG] với [IMG] khác nhau như thế nào?
A. Khác nhau về [IMG] và kích thước
B. Giống nhau
C. Có màu [IMG] giống nhau
```

Sẽ được parse thành:

```javascript
{
  contentParts: [
    { content: "Câu 1: Hãy so sánh ", contentType: "TEXT" },
    { content: "/uploads/.../image1.png", contentType: "IMAGE" },
    { content: " với ", contentType: "TEXT" },
    { content: "/uploads/.../image2.png", contentType: "IMAGE" },
    { content: " khác nhau như thế nào?", contentType: "TEXT" }
  ],
  answers: [
    {
      answerParts: [
        { content: "Khác nhau về ", contentType: "TEXT" },
        { content: "/uploads/.../image3.png", contentType: "IMAGE" },
        { content: " và kích thước", contentType: "TEXT" }
      ]
    },
    { content: "Giống nhau", contentType: "TEXT" },
    {
      answerParts: [
        { content: "Có màu ", contentType: "TEXT" },
        { content: "/uploads/.../image4.png", contentType: "IMAGE" },
        { content: " giống nhau", contentType: "TEXT" }
      ]
    }
  ]
}
```

### 3. API Endpoints

#### Question Endpoints

##### GET /question/:id

Lấy thông tin câu hỏi, bao gồm `nextContentDetails` nếu có nextContent.

**Response:**

```json
{
  "id": "01",
  "content": "Hãy so sánh ảnh",
  "contentType": "TEXT",
  "nextContent": "02",
  "nextContentDetails": {
    "id": "02",
    "content": "anh1.png",
    "contentType": "IMAGE"
  }
}
```

##### GET /question/:id/chain

Lấy toàn bộ chuỗi nội dung của câu hỏi.

**Response:**

```json
[
  {
    "id": "01",
    "content": "Hãy so sánh ảnh",
    "contentType": "TEXT",
    "nextContent": "02"
  },
  {
    "id": "02",
    "content": "anh1.png",
    "contentType": "IMAGE",
    "nextContent": "03"
  },
  {
    "id": "03",
    "content": "và ảnh",
    "contentType": "TEXT",
    "nextContent": "04"
  },
  {
    "id": "04",
    "content": "anh2.png",
    "contentType": "IMAGE",
    "nextContent": "05"
  },
  {
    "id": "05",
    "content": "khác nhau như thế nào?",
    "contentType": "TEXT",
    "nextContent": null,
    "answers": [...]
  }
]
```

#### Answer Endpoints

##### GET /answer/:id

Lấy thông tin câu trả lời, bao gồm `nextContentDetails` nếu có nextContent.

**Response:**

```json
{
  "id": "A1",
  "content": "Khác nhau về",
  "contentType": "TEXT",
  "questionId": "05",
  "nextContent": "A2",
  "nextContentDetails": {
    "id": "A2",
    "content": "mau_sac.png",
    "contentType": "IMAGE"
  }
}
```

##### GET /answer/:id/chain

Lấy toàn bộ chuỗi nội dung của câu trả lời.

**Response:**

```json
[
  {
    "id": "A1",
    "content": "Khác nhau về",
    "contentType": "TEXT",
    "nextContent": "A2"
  },
  {
    "id": "A2",
    "content": "mau_sac.png",
    "contentType": "IMAGE",
    "nextContent": "A3"
  },
  {
    "id": "A3",
    "content": "và kích thước",
    "contentType": "TEXT",
    "nextContent": null
  }
]
```

## Cách sử dụng

### 1. Import câu hỏi từ PDF

```typescript
// POST /question-bank/:id/import-pdf
// Upload file PDF với câu hỏi và câu trả lời có marker [IMG], (hình), [ảnh]

// Ví dụ PDF content:
// Câu 1: Hãy so sánh [IMG] và [IMG] khác nhau như thế nào?
// A. Khác nhau về [IMG] và kích thước
// B. Giống nhau

// Hệ thống tự động:
// 1. Extract images từ PDF
// 2. Parse text và phát hiện marker trong câu hỏi và câu trả lời
// 3. Tạo content chain với nextContent cho cả question và answer
// 4. Lưu vào database
```

### 2. Hiển thị câu hỏi và câu trả lời trên Frontend

```typescript
// Hiển thị câu hỏi với chain
async function displayQuestionChain(questionId: string) {
  const chain = await getQuestionChain(questionId);

  // Hiển thị các phần của câu hỏi
  chain.forEach((part) => {
    if (part.contentType === 'TEXT') {
      displayText(part.content);
    } else {
      displayImage(part.content);
    }
  });

  // Answers nằm ở phần cuối cùng
  const lastPart = chain[chain.length - 1];

  // Hiển thị các câu trả lời
  for (const answer of lastPart.answers) {
    if (answer.nextContent) {
      // Answer có chain - lấy toàn bộ chain
      const answerChain = await getAnswerChain(answer.id);
      answerChain.forEach((answerPart) => {
        if (answerPart.contentType === 'TEXT') {
          displayText(answerPart.content);
        } else {
          displayImage(answerPart.content);
        }
      });
    } else {
      // Answer đơn giản
      if (answer.contentType === 'TEXT') {
        displayText(answer.content);
      } else {
        displayImage(answer.content);
      }
    }
  }
}

// Hoặc dùng nextContentDetails để traverse thủ công
async function displayWithNextContent(questionId: string) {
  // Hiển thị câu hỏi
  let currentQuestion = await getQuestion(questionId);

  while (currentQuestion) {
    if (currentQuestion.contentType === 'TEXT') {
      displayText(currentQuestion.content);
    } else {
      displayImage(currentQuestion.content);
    }

    if (currentQuestion.nextContentDetails) {
      currentQuestion = await getQuestion(currentQuestion.nextContent);
    } else {
      break;
    }
  }

  // Hiển thị câu trả lời
  for (const answer of currentQuestion.answers) {
    let currentAnswer = answer;

    while (currentAnswer) {
      if (currentAnswer.contentType === 'TEXT') {
        displayText(currentAnswer.content);
      } else {
        displayImage(currentAnswer.content);
      }

      if (currentAnswer.nextContentDetails) {
        currentAnswer = await getAnswer(currentAnswer.nextContent);
      } else {
        break;
      }
    }
  }
}
```

### 3. Tạo câu hỏi và câu trả lời thủ công với nextContent

```typescript
// Tạo câu hỏi với chain
const question1 = await createQuestion({
  content: 'Hãy so sánh ảnh',
  contentType: 'TEXT',
  questionBankId: '...',
});

const question2 = await createQuestion({
  content: 'anh1.png',
  contentType: 'IMAGE',
  questionBankId: '...',
});

const question3 = await createQuestion({
  content: 'với ảnh',
  contentType: 'TEXT',
  questionBankId: '...',
});

// Link các parts lại
await updateQuestion(question1.id, { nextContent: question2.id });
await updateQuestion(question2.id, { nextContent: question3.id });

// Tạo câu trả lời với chain
const answer1 = await createAnswer({
  content: 'Khác nhau về',
  contentType: 'TEXT',
  questionId: question3.id,
});

const answer2 = await createAnswer({
  content: 'mau_sac.png',
  contentType: 'IMAGE',
  questionId: question3.id,
});

const answer3 = await createAnswer({
  content: 'và kích thước',
  contentType: 'TEXT',
  questionId: question3.id,
});

// Link các answer parts lại
await updateAnswer(answer1.id, { nextContent: answer2.id });
await updateAnswer(answer2.id, { nextContent: answer3.id });
```

## Notes

### Giới hạn

- Maximum chain depth: 10 levels (để tránh infinite loops) cho cả question và answer
- Chỉ phần cuối cùng của question chain mới có answers
- Các answer có thể có chain riêng độc lập với nhau
- Tất cả các phần trong chain phải thuộc cùng questionBankId (question) hoặc questionId (answer)

### Best Practices

1. Luôn sử dụng endpoint `/chain` khi cần hiển thị toàn bộ câu hỏi/câu trả lời
2. Cache chain data ở frontend để tránh gọi API nhiều lần
3. Validate chain integrity trước khi hiển thị (check nextContent exists)
4. Đối với PDF import, đảm bảo marker rõ ràng và nhất quán cho cả question và answer
5. Hiển thị loading indicator khi traverse chain dài

### Performance

- `findOne` và `findAll` tự động populate `nextContentDetails` (chỉ 1 level) cho cả question và answer
- `getQuestionWithChain` và `getAnswerWithChain` load toàn bộ chain, nên chỉ dùng khi cần thiết
- Sử dụng pagination khi load danh sách câu hỏi/câu trả lời để tránh quá tải
- Với câu hỏi phức tạp có nhiều answer chains, consider lazy loading answers

### Ví dụ thực tế

#### Câu hỏi dạng so sánh 2 hình ảnh

```
Question Chain:
01: "So sánh hai hình ảnh" (TEXT)
02: "image1.png" (IMAGE)
03: "và" (TEXT)
04: "image2.png" (IMAGE)
05: "về mặt màu sắc" (TEXT)

Answers:
A1: "Hình 1 có màu" (TEXT) → A2: "red.png" (IMAGE) → A3: ", hình 2 có màu" (TEXT) → A4: "blue.png" (IMAGE)
B1: "Giống nhau" (TEXT)
```

#### Câu hỏi giải thích ảnh

```
Question Chain:
01: "Hãy giải thích ý nghĩa của bức tranh" (TEXT)
02: "tranh.png" (IMAGE)

Answers:
A1: "Bức tranh thể hiện" (TEXT) → A2: "freedom.png" (IMAGE) → A3: "tự do" (TEXT)
B1: "Không rõ ràng" (TEXT)
```
