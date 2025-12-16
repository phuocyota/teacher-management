-- =============================================
-- SEED DATA FOR TEACHER MANAGEMENT SYSTEM
-- =============================================

-- Clean existing data (optional - uncomment if needed)
-- TRUNCATE TABLE device_requests CASCADE;
-- TRUNCATE TABLE approved_devices CASCADE;
-- TRUNCATE TABLE license CASCADE;
-- TRUNCATE TABLE class CASCADE;
-- TRUNCATE TABLE lecture_entity CASCADE;
-- TRUNCATE TABLE teacher_entity CASCADE;
-- TRUNCATE TABLE "user" CASCADE;

-- =============================================
-- 1. USER TABLE
-- Password: 'password123' hashed with bcrypt
-- =============================================
INSERT INTO "user" (
  id, user_name, full_name, hash_password, email, phone_number, 
  birthday, gender, citizen_id, address, note,
  user_type, status, is_disabled, disabled_at, activated_date, expired_date,
  can_create_teacher_code, can_create_admin_code, can_add_lesson, can_update_lesson, can_manage_lesson, can_manage_account, is_linked_account,
  last_login_at, last_login_ip, created_ip,
  created_at, updated_at
) VALUES
-- Admin chính - có đầy đủ quyền
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'admin', 'Nguyễn Văn Admin', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin@school.edu.vn', '0901234567',
 '1985-05-15', 'MALE', '001085012345', '123 Đường Lê Lợi, Quận 1, TP.HCM', 'Quản trị viên hệ thống',
 'ADMIN', 'ACTIVE', false, NULL, '2024-01-01', '2099-12-31',
 true, true, true, true, true, true, false,
 NOW() - INTERVAL '1 hour', '192.168.1.100', '192.168.1.100',
 NOW(), NOW()),

-- Admin phụ - có một số quyền
('11111111-1111-1111-1111-111111111111', 'admin2', 'Trần Văn Phó', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'pho.tran@school.edu.vn', '0901111111',
 '1988-03-20', 'MALE', '001088034567', '456 Đường Nguyễn Huệ, Quận 1, TP.HCM', 'Phó quản trị',
 'ADMIN', 'ACTIVE', false, NULL, '2024-02-01', '2025-12-31',
 true, false, true, true, true, true, false,
 NOW() - INTERVAL '2 days', '192.168.1.101', '192.168.1.101',
 NOW(), NOW()),

-- Giáo viên 1 - đầy đủ thông tin
('b2c3d4e5-f6a7-8901-bcde-f23456789012', 'teacher1', 'Trần Thị Hương', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'huong.tran@school.edu.vn', '0902345678',
 '1990-08-25', 'FEMALE', '001090087654', '789 Đường Hai Bà Trưng, Quận 3, TP.HCM', 'Giáo viên Toán lớp 10',
 'TEACHER', 'ACTIVE', false, NULL, '2024-01-15', '2025-06-30',
 false, false, true, true, false, false, false,
 NOW() - INTERVAL '3 hours', '192.168.1.102', '192.168.1.102',
 NOW(), NOW()),

-- Giáo viên 2
('c3d4e5f6-a7b8-9012-cdef-345678901234', 'teacher2', 'Lê Văn Minh', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'minh.le@school.edu.vn', '0903456789',
 '1987-12-10', 'MALE', '001087121234', '321 Đường Võ Văn Tần, Quận 3, TP.HCM', 'Giáo viên Vật lý',
 'TEACHER', 'ACTIVE', false, NULL, '2024-01-15', '2025-06-30',
 false, false, true, true, true, false, false,
 NOW() - INTERVAL '1 day', '192.168.1.103', '192.168.1.103',
 NOW(), NOW()),

-- Giáo viên 3
('d4e5f6a7-b8c9-0123-defa-456789012345', 'teacher3', 'Phạm Thị Lan', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'lan.pham@school.edu.vn', '0904567890',
 '1992-04-05', 'FEMALE', '001092045678', '555 Đường Điện Biên Phủ, Quận Bình Thạnh, TP.HCM', 'Giáo viên Hóa học',
 'TEACHER', 'ACTIVE', false, NULL, '2024-02-01', '2025-08-31',
 false, false, true, false, false, false, false,
 NOW() - INTERVAL '5 days', '192.168.1.104', '192.168.1.104',
 NOW(), NOW()),

-- Giáo viên 4 - INACTIVE
('e5f6a7b8-c9d0-1234-efab-567890123456', 'teacher4', 'Hoàng Văn Đức', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'duc.hoang@school.edu.vn', '0905678901',
 '1989-07-18', 'MALE', '001089078901', '777 Đường Cách Mạng Tháng 8, Quận 10, TP.HCM', 'Giáo viên Ngữ văn - Đã nghỉ việc',
 'TEACHER', 'INACTIVE', false, NULL, '2024-01-01', '2024-12-31',
 false, false, false, false, false, false, false,
 NOW() - INTERVAL '30 days', '192.168.1.105', '192.168.1.105',
 NOW(), NOW()),

-- Giáo viên 5 - bị vô hiệu hóa
('22222222-2222-2222-2222-222222222222', 'teacher5', 'Ngô Thị Mai', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'mai.ngo@school.edu.vn', '0906789012',
 '1991-11-30', 'FEMALE', '001091112345', '888 Đường Lý Thường Kiệt, Quận Tân Bình, TP.HCM', 'Giáo viên Tiếng Anh - Tạm khóa do vi phạm',
 'TEACHER', 'ACTIVE', true, NOW() - INTERVAL '7 days', '2024-03-01', '2025-03-01',
 false, false, true, true, false, false, false,
 NOW() - INTERVAL '7 days', '192.168.1.106', '192.168.1.106',
 NOW(), NOW()),

-- Giáo viên 6 - tài khoản liên kết
('33333333-3333-3333-3333-333333333333', 'teacher6', 'Đỗ Văn Hùng', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'hung.do@school.edu.vn', '0907890123',
 '1986-02-14', 'MALE', '001086023456', '999 Đường Trường Chinh, Quận Tân Phú, TP.HCM', 'Giáo viên Lịch sử - Tài khoản liên kết',
 'TEACHER', 'ACTIVE', false, NULL, '2024-04-01', '2025-04-01',
 false, false, true, true, false, false, true,
 NOW() - INTERVAL '2 hours', '192.168.1.107', '192.168.1.107',
 NOW(), NOW()),

-- Giáo viên 7 - mới tạo, chưa login
('44444444-4444-4444-4444-444444444444', 'teacher7', 'Bùi Thị Hồng', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'hong.bui@school.edu.vn', '0908901234',
 '1993-09-22', 'FEMALE', '001093095678', '100 Đường Nguyễn Văn Cừ, Quận 5, TP.HCM', 'Giáo viên Địa lý - Mới',
 'TEACHER', 'ACTIVE', false, NULL, '2024-12-01', '2025-12-01',
 false, false, true, false, false, false, false,
 NULL, NULL, '192.168.1.108',
 NOW(), NOW()),

-- Giáo viên 8 - tài khoản hết hạn
('55555555-5555-5555-5555-555555555555', 'teacher8', 'Vũ Minh Tuấn', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'tuan.vu@school.edu.vn', '0909012345',
 '1984-06-08', 'MALE', '001084067890', '200 Đường Phan Xích Long, Quận Phú Nhuận, TP.HCM', 'Giáo viên Tin học - Hết hạn license',
 'TEACHER', 'INACTIVE', false, NULL, '2023-01-01', '2024-01-01',
 false, false, false, false, false, false, false,
 NOW() - INTERVAL '365 days', '192.168.1.109', '192.168.1.109',
 NOW() - INTERVAL '365 days', NOW()),

-- Giáo viên 9 - có quyền quản lý bài giảng
('66666666-6666-6666-6666-666666666666', 'teacher9', 'Lý Thị Thanh', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'thanh.ly@school.edu.vn', '0910123456',
 '1988-01-25', 'FEMALE', '001088015678', '300 Đường Hoàng Văn Thụ, Quận Tân Bình, TP.HCM', 'Tổ trưởng tổ Toán',
 'TEACHER', 'ACTIVE', false, NULL, '2024-01-01', '2025-12-31',
 true, false, true, true, true, false, false,
 NOW() - INTERVAL '4 hours', '192.168.1.110', '192.168.1.110',
 NOW(), NOW()),

-- Giáo viên 10 - giới tính OTHER
('77777777-7777-7777-7777-777777777777', 'teacher10', 'Alex Nguyen', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'alex.nguyen@school.edu.vn', '0911234567',
 '1995-10-12', 'OTHER', NULL, '400 Đường Nguyễn Thị Minh Khai, Quận 1, TP.HCM', 'Giáo viên nước ngoài',
 'TEACHER', 'ACTIVE', false, NULL, '2024-06-01', '2025-06-01',
 false, false, true, true, false, false, false,
 NOW() - INTERVAL '12 hours', '192.168.1.111', '192.168.1.111',
 NOW(), NOW());

-- =============================================
-- 2. TEACHER TABLE
-- =============================================
INSERT INTO teacher_entity (id, name, email, device_id, status, created_at, updated_at) VALUES
('f6a7b8c9-d0e1-2345-fabc-678901234567', 'Trần Thị Hương', 'huong.tran@school.edu.vn', 'DEVICE-TEACHER-001', 'ACTIVE', NOW(), NOW()),
('a7b8c9d0-e1f2-3456-abcd-789012345678', 'Lê Văn Minh', 'minh.le@school.edu.vn', 'DEVICE-TEACHER-002', 'ACTIVE', NOW(), NOW()),
('b8c9d0e1-f2a3-4567-bcde-890123456789', 'Phạm Thị Lan', 'lan.pham@school.edu.vn', 'DEVICE-TEACHER-003', 'ACTIVE', NOW(), NOW()),
('c9d0e1f2-a3b4-5678-cdef-901234567890', 'Hoàng Văn Đức', 'duc.hoang@school.edu.vn', 'DEVICE-TEACHER-004', 'INACTIVE', NOW(), NOW()),
('d0e1f2a3-b4c5-6789-defa-012345678901', 'Vũ Thị Mai', 'mai.vu@school.edu.vn', 'DEVICE-TEACHER-005', 'ACTIVE', NOW(), NOW());

-- =============================================
-- 3. LECTURE TABLE
-- =============================================
INSERT INTO lecture_entity (id, title, description, status, created_at, updated_at) VALUES
('e1f2a3b4-c5d6-7890-efab-123456789012', 'Toán học cơ bản', 'Bài giảng về các khái niệm toán học cơ bản cho học sinh lớp 10', 'ACTIVE', NOW(), NOW()),
('f2a3b4c5-d6e7-8901-fabc-234567890123', 'Vật lý đại cương', 'Giới thiệu về các định luật vật lý cơ bản', 'ACTIVE', NOW(), NOW()),
('a3b4c5d6-e7f8-9012-abcd-345678901234', 'Hóa học hữu cơ', 'Bài giảng về hóa học hữu cơ và các hợp chất carbon', 'ACTIVE', NOW(), NOW()),
('b4c5d6e7-f8a9-0123-bcde-456789012345', 'Ngữ văn Việt Nam', 'Phân tích các tác phẩm văn học Việt Nam hiện đại', 'ACTIVE', NOW(), NOW()),
('c5d6e7f8-a9b0-1234-cdef-567890123456', 'Tiếng Anh giao tiếp', 'Bài giảng về kỹ năng giao tiếp tiếng Anh cơ bản', 'ACTIVE', NOW(), NOW()),
('d6e7f8a9-b0c1-2345-defa-678901234567', 'Lịch sử Việt Nam', 'Lịch sử Việt Nam từ thời kỳ Bắc thuộc đến hiện đại', 'INACTIVE', NOW(), NOW()),
('e7f8a9b0-c1d2-3456-efab-789012345678', 'Địa lý tự nhiên', 'Địa lý tự nhiên Việt Nam và các vùng miền', 'ACTIVE', NOW(), NOW());

-- =============================================
-- 4. CLASS TABLE
-- =============================================
INSERT INTO class (id, code, name, order_number, display_type, current_image, note, status, created_at, updated_at) VALUES
('f8a9b0c1-d2e3-4567-fabc-890123456789', 'LOP10A1', 'Lớp 10A1', 1, 'ADVANCED', NULL, 'Lớp chuyên Toán', 'ACTIVE', NOW(), NOW()),
('a9b0c1d2-e3f4-5678-abcd-901234567890', 'LOP10A2', 'Lớp 10A2', 2, 'ADVANCED', NULL, 'Lớp chuyên Lý', 'ACTIVE', NOW(), NOW()),
('b0c1d2e3-f4a5-6789-bcde-012345678901', 'LOP10B1', 'Lớp 10B1', 3, 'BASIC', NULL, 'Lớp thường', 'ACTIVE', NOW(), NOW()),
('c1d2e3f4-a5b6-7890-cdef-123456789012', 'LOP11A1', 'Lớp 11A1', 4, 'ADVANCED', NULL, 'Lớp chuyên Hóa', 'ACTIVE', NOW(), NOW()),
('d2e3f4a5-b6c7-8901-defa-234567890123', 'LOP11B1', 'Lớp 11B1', 5, 'BASIC', NULL, 'Lớp thường', 'ACTIVE', NOW(), NOW()),
('e3f4a5b6-c7d8-9012-efab-345678901234', 'LOP12A1', 'Lớp 12A1', 6, 'ADVANCED', NULL, 'Lớp chuyên Anh', 'ACTIVE', NOW(), NOW()),
('f4a5b6c7-d8e9-0123-fabc-456789012345', 'LOP12B1', 'Lớp 12B1', 7, 'NONE', NULL, 'Lớp đã nghỉ', 'INACTIVE', NOW(), NOW());

-- =============================================
-- 5. LICENSE TABLE
-- =============================================
INSERT INTO license (id, key, "activationDate", "expirationDate", "userId", status, created_at, updated_at) VALUES
('a5b6c7d8-e9f0-1234-abcd-567890123456', 'LIC-2024-ADMIN-001', '2024-01-01', '2025-12-31', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'ACTIVE', NOW(), NOW()),
('b6c7d8e9-f0a1-2345-bcde-678901234567', 'LIC-2024-TEACH-001', '2024-01-01', '2025-06-30', 'b2c3d4e5-f6a7-8901-bcde-f23456789012', 'ACTIVE', NOW(), NOW()),
('c7d8e9f0-a1b2-3456-cdef-789012345678', 'LIC-2024-TEACH-002', '2024-01-01', '2025-06-30', 'c3d4e5f6-a7b8-9012-cdef-345678901234', 'ACTIVE', NOW(), NOW()),
('d8e9f0a1-b2c3-4567-defa-890123456789', 'LIC-2024-TEACH-003', '2024-01-01', '2024-12-31', 'd4e5f6a7-b8c9-0123-defa-456789012345', 'INACTIVE', NOW(), NOW()),
('e9f0a1b2-c3d4-5678-efab-901234567890', 'LIC-2024-TEACH-004', '2024-06-01', '2025-05-31', 'e5f6a7b8-c9d0-1234-efab-567890123456', 'ACTIVE', NOW(), NOW());

-- =============================================
-- 6. APPROVED DEVICES TABLE
-- =============================================
INSERT INTO approved_devices (id, device_id, product_key, user_id, approved_at, approved_by) VALUES
('f0a1b2c3-d4e5-6789-fabc-012345678901', 'DEV-IPAD-001', 'PROD-KEY-APPLE-001', 'b2c3d4e5-f6a7-8901-bcde-f23456789012', NOW(), 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
('a1b2c3d4-e5f6-7890-abcd-123456789012', 'DEV-IPAD-002', 'PROD-KEY-APPLE-002', 'c3d4e5f6-a7b8-9012-cdef-345678901234', NOW(), 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
('b2c3d4e5-f6a7-8901-bcde-234567890123', 'DEV-ANDROID-001', 'PROD-KEY-SAMSUNG-001', 'd4e5f6a7-b8c9-0123-defa-456789012345', NOW(), 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
('c3d4e5f6-a7b8-9012-cdef-345678901234', 'DEV-LAPTOP-001', 'PROD-KEY-DELL-001', 'e5f6a7b8-c9d0-1234-efab-567890123456', NOW(), 'a1b2c3d4-e5f6-7890-abcd-ef1234567890');

-- =============================================
-- 7. DEVICE REQUESTS TABLE
-- =============================================
INSERT INTO device_requests (id, device_id, product_key, metadata, status, reject_reason, created_at, created_by, updated_by) VALUES
('d4e5f6a7-b8c9-0123-defa-456789012345', 'DEV-NEW-IPAD-001', 'PROD-KEY-APPLE-NEW-001', '{"model": "iPad Pro 12.9", "os": "iPadOS 17", "storage": "256GB"}', 'PENDING', '', NOW(), 'b2c3d4e5-f6a7-8901-bcde-f23456789012', NULL),
('e5f6a7b8-c9d0-1234-efab-567890123456', 'DEV-NEW-ANDROID-001', 'PROD-KEY-XIAOMI-001', '{"model": "Xiaomi Pad 6", "os": "Android 14", "storage": "128GB"}', 'PENDING', '', NOW(), 'c3d4e5f6-a7b8-9012-cdef-345678901234', NULL),
('f6a7b8c9-d0e1-2345-fabc-678901234567', 'DEV-OLD-TABLET-001', 'PROD-KEY-OLD-001', '{"model": "Old Tablet", "os": "Android 10", "storage": "32GB"}', 'REJECT', 'Thiết bị quá cũ, không đáp ứng yêu cầu hệ thống', NOW() - INTERVAL '7 days', 'd4e5f6a7-b8c9-0123-defa-456789012345', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
('a7b8c9d0-e1f2-3456-abcd-789012345678', 'DEV-APPROVED-MAC-001', 'PROD-KEY-MAC-001', '{"model": "MacBook Air M2", "os": "macOS Sonoma", "storage": "512GB"}', 'APPROVED', '', NOW() - INTERVAL '3 days', 'e5f6a7b8-c9d0-1234-efab-567890123456', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890');

-- =============================================
-- VERIFICATION QUERIES (optional - run to verify data)
-- =============================================
-- SELECT 'Users' as table_name, COUNT(*) as count FROM "user"
-- UNION ALL SELECT 'Teachers', COUNT(*) FROM teacher_entity
-- UNION ALL SELECT 'Lectures', COUNT(*) FROM lecture_entity
-- UNION ALL SELECT 'Classes', COUNT(*) FROM class
-- UNION ALL SELECT 'Licenses', COUNT(*) FROM license
-- UNION ALL SELECT 'Approved Devices', COUNT(*) FROM approved_devices
-- UNION ALL SELECT 'Device Requests', COUNT(*) FROM device_requests;
