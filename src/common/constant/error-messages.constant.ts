/**
 * Các thông báo lỗi tiếng Việt dùng chung trong ứng dụng
 */
export const ERROR_MESSAGES = {
  // Auth errors
  INVALID_CREDENTIALS: 'Thông tin đăng nhập không hợp lệ',
  MISSING_AUTHORIZATION_HEADER: 'Thiếu header xác thực',
  INVALID_TOKEN: 'Token không hợp lệ',
  INVALID_TOKEN_STRUCTURE:
    'Cấu trúc token không hợp lệ (thiếu trường bắt buộc)',
  ACCESS_DENIED_ADMIN: 'Truy cập bị từ chối. Chỉ dành cho Admin.',
  ACCESS_DENIED_TEACHER: 'Truy cập bị từ chối. Chỉ dành cho Giáo viên.',
  ACCESS_DENIED_STUDENT: 'Truy cập bị từ chối. Chỉ dành cho Học sinh.',

  // Not found errors
  NOT_FOUND: (entity: string) => `${entity} không tồn tại`,
  NOT_FOUND_WITH_ID: (entity: string, id: string) =>
    `${entity} với ID ${id} không tồn tại`,
  SOME_ENTITY_NOT_FOUND: (entity: string) => `Một số ${entity} không tồn tại`,

  // Device errors
  DEVICE_REQUEST_ALREADY_PROCESSED: (status: string) =>
    `Request đã được xử lý với trạng thái: ${status}`,

  // Group errors
  NO_PERMISSION_UPDATE_GROUP: 'Bạn không có quyền cập nhật group này',
  NO_PERMISSION_DELETE_GROUP: 'Chỉ admin mới có thể xóa group',
  NO_PERMISSION_ADD_MEMBER: 'Bạn không có quyền thêm thành viên vào group này',
  NO_PERMISSION_REMOVE_MEMBER:
    'Bạn không có quyền xóa thành viên khỏi group này',
  SOME_USERS_NOT_FOUND: 'Một số user không tồn tại',
  SOME_GROUPS_NOT_FOUND: 'Một số group không tồn tại',

  // User errors
  USERNAME_ALREADY_EXISTS: 'Tên đăng nhập đã tồn tại',
  EMAIL_ALREADY_EXISTS: 'Email đã tồn tại',
  USER_ALREADY_EXISTS: 'Người dùng đã tồn tại',
  CURRENT_PASSWORD_INCORRECT: 'Mật khẩu hiện tại không đúng',
  NO_PERMISSION_CREATE_USER: 'Bạn không có quyền tạo người dùng',

  // Input errors
  INVALID_INPUT: 'Dữ liệu đầu vào không hợp lệ',
  NO_PERMISSION_SUBMIT_ATTEMPT: 'Bạn không được phép nộp bài làm này',
  ATTEMPT_ALREADY_ENDED: 'Bài làm này đã kết thúc',
  ATTEMPT_INVALID_QUESTION_IN_SUBMISSION:
    'Danh sách câu trả lời có câu hỏi không thuộc đề thi',
  ATTEMPT_INVALID_ANSWER_MAPPING:
    'answerId không khớp với questionId được gửi lên',
  ATTEMPT_INVALID_SELECTED_ANSWER_MAPPING:
    'selectedAnswerIds không khớp với questionId được gửi lên',
  QUESTION_BANK_NOT_IN_EXAM_SET:
    'Question bank không nằm trong exam set được chọn',
};

/**
 * Tên các entity tiếng Việt
 */
export const ENTITY_NAMES = {
  TEACHER: 'Giáo viên',
  CLASS: 'Lớp học',
  DEVICE_REQUEST: 'Yêu cầu thiết bị',
  USER: 'Người dùng',
  LICENSE: 'Giấy phép',
  LECTURE: 'Bài giảng',
  GROUP: 'Nhóm',
  COURSE: 'Khóa học',
  QUESTION_BANK: 'Ngân hàng câu hỏi',
  QUESTION_BANK_QUESTION: 'Liên kết ngân hàng câu hỏi',
  QUESTION: 'Câu hỏi',
  ANSWER: 'Câu trả lời',
  STUDENT: 'Học sinh',
  STUDENT_GROUP: 'Nhóm học sinh',
  SCHOOL: 'Trường học',
  ATTEMPT: 'Bài làm',
  STUDENT_ANSWER: 'Câu trả lời học sinh',
  GRADE: 'Khối',
  SUBJECT: 'Môn học',
  EXAM_SET: 'Bộ đề thi',
  EXAM_SET_QUESTION_BANK: 'Liên kết bộ đề thi và ngân hàng câu hỏi',
  ZONE: 'Khu vực',
};
