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

  // Not found errors
  NOT_FOUND: (entity: string) => `${entity} không tồn tại`,
  NOT_FOUND_WITH_ID: (entity: string, id: string) =>
    `${entity} với ID ${id} không tồn tại`,

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

  // Input errors
  INVALID_INPUT: 'Dữ liệu đầu vào không hợp lệ',
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
};
