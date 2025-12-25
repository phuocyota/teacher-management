/**
 * Enum định nghĩa mức độ hiển thị của file
 */
export enum FileVisibility {
  /**
   * Ai cũng có thể xem được
   */
  PUBLIC = 'PUBLIC',

  /**
   * Chỉ người upload mới xem được
   */
  PRIVATE = 'PRIVATE',

  /**
   * Chỉ những người được cấp quyền mới xem được
   */
  RESTRICTED = 'RESTRICTED',
}

/**
 * Enum định nghĩa loại file
 */
export enum FileType {
  /**
   * File bình thường (ảnh, video, documents, etc.)
   */
  NORMAL = 'NORMAL',

  /**
   * File cấu hình (config files, settings, etc.)
   */
  CONFIG = 'CONFIG',
}

/**
 * Enum định nghĩa loại quyền truy cập file
 */
export enum FileAccessType {
  /**
   * Chỉ xem
   */
  VIEW = 'VIEW',

  /**
   * Có thể tải về
   */
  DOWNLOAD = 'DOWNLOAD',

  /**
   * Toàn quyền (xem, tải, xóa)
   */
  FULL = 'FULL',
}
