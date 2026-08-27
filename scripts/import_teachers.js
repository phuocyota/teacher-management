#!/usr/bin/env node

/**
 * IMPORT GIÁO VIÊN - MỘT FILE DÙNG CHUNG
 *
 * Script này thay thế các file import_teachers_groupXX.js riêng lẻ. Nó thực hiện
 * trọn luồng trong một lần chạy: đọc Excel, kiểm tra dữ liệu, mở transaction,
 * tạo user/teacher/user_group, xác minh kết quả và xuất file tài khoản.
 *
 * Ví dụ tối thiểu (cột A = STT, B = họ tên):
 * node scripts/import_teachers.js --input "DS giáo viên.xlsx" --group 46 --prefix thabcgv --commit
 *
 * Ví dụ đầy đủ:
 * node scripts/import_teachers.js --input "DS giáo viên.xls" --sheet "Sheet1" --group 46 --prefix thabcgv --start-row 5 --stt-col A --name-col B --birthday-col C --gender-col D --class-col E --phone-col F --email-col G --note-cols "H:Chức vụ,I:Ghi chú" --output "exports/tai-khoan-gv-group46.xlsx" --commit
 *
 * Mặc định script chỉ xem trước, không ghi DB. Phải truyền --commit để import.
 * Dùng --help để xem toàn bộ tham số.
 */

const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const ExcelJS = require('exceljs');
const { Client } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const HELP = `
Import giáo viên từ Excel vào teacher-management

Bắt buộc:
  --input <file>         File .xls hoặc .xlsx
  --group <code>        Code của group cần thêm giáo viên
  --prefix <text>       Tiền tố username, ví dụ thpmagv

Ánh xạ cột (chấp nhận A, B... hoặc 1, 2...):
  --stt-col <col>       Cột STT, mặc định A
  --name-col <col>      Cột họ tên, mặc định B
  --gender-col <col>    Cột giới tính
  --birthday-col <col>  Cột ngày sinh
  --phone-col <col>     Cột số điện thoại
  --email-col <col>     Cột email
  --class-col <col>     Cột lớp/phân công
  --note-cols <mapping> Các cột ghi chú, ví dụ "D:Chức vụ,E:Nhiệm vụ"

Tùy chọn:
  --sheet <name>        Tên sheet; mặc định lấy sheet đầu tiên
  --start-row <number>  Dòng bắt đầu đọc, mặc định 1
  --password <text>     Mật khẩu chung, mặc định ichi123456
  --output <file>       File kết quả; mặc định exports/tai-khoan-gv-group<code>.xlsx
  --commit              Thực sự ghi DB; thiếu cờ này chỉ xem trước
  --allow-existing      Cho phép import vào group đã có giáo viên
  --overwrite           Cho phép ghi đè file kết quả đã tồn tại
  --help                Hiển thị hướng dẫn

Ví dụ:
  node scripts/import_teachers.js --input "PMA_THÔNG TIN GIÁO VIÊN TRƯỜNG.xlsx" --group 45 --prefix thpmagv --start-row 3 --gender-col C --class-col D --phone-col E --commit
`;

function parseArgs(argv) {
  const args = {};
  const booleanOptions = new Set([
    'commit',
    'allow-existing',
    'overwrite',
    'help',
  ]);

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      throw new Error(`Tham số không hợp lệ: ${token}`);
    }

    const key = token.slice(2);
    if (booleanOptions.has(key)) {
      args[key] = true;
      continue;
    }

    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`Thiếu giá trị cho --${key}`);
    }
    args[key] = value;
    index += 1;
  }

  return args;
}

function required(args, key) {
  const value = args[key];
  if (value === undefined || String(value).trim() === '') {
    throw new Error(`Thiếu tham số bắt buộc --${key}`);
  }
  return String(value).trim();
}

function columnIndex(value, optionName) {
  if (value === undefined) return null;
  const text = String(value).trim().toUpperCase();
  if (/^\d+$/.test(text)) {
    const number = Number(text);
    if (number < 1) throw new Error(`--${optionName} phải lớn hơn hoặc bằng 1`);
    return number - 1;
  }
  if (!/^[A-Z]+$/.test(text)) {
    throw new Error(`Cột không hợp lệ cho --${optionName}: ${value}`);
  }

  let result = 0;
  for (const character of text) {
    result = result * 26 + character.charCodeAt(0) - 64;
  }
  return result - 1;
}

function text(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value).trim().replace(/\s+/g, ' ');
}

function normalizeVietnamese(value) {
  return text(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

function usernamePart(value) {
  return normalizeVietnamese(value)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function firstName(fullName) {
  const parts = text(fullName).split(/\s+/);
  return usernamePart(parts[parts.length - 1]);
}

function parseGender(value) {
  const normalized = normalizeVietnamese(value).toLowerCase();
  if (!normalized) return null;
  if (
    normalized === 'x' ||
    normalized.includes('nu') ||
    normalized === 'female'
  ) {
    return 'FEMALE';
  }
  if (normalized.includes('nam') || normalized === 'male') return 'MALE';
  return null;
}

function parseDate(value) {
  if (value === null || value === undefined || value === '') {
    return { value: null, display: '' };
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return {
      value,
      display: `${String(value.getDate()).padStart(2, '0')}/${String(
        value.getMonth() + 1,
      ).padStart(2, '0')}/${value.getFullYear()}`,
    };
  }

  if (typeof value === 'number' && value > 0) {
    const parsed = xlsx.SSF.parse_date_code(value);
    if (parsed) {
      const date = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
      return {
        value: date,
        display: `${String(parsed.d).padStart(2, '0')}/${String(
          parsed.m,
        ).padStart(2, '0')}/${parsed.y}`,
      };
    }
  }

  const raw = text(value);
  const match = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (!match) return { value: null, display: raw };

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  const isValid =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
  return { value: isValid ? date : null, display: raw };
}

function parseNoteColumns(value) {
  if (!value) return [];
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const separator = item.indexOf(':');
      const column = separator >= 0 ? item.slice(0, separator) : item;
      const label =
        separator >= 0 ? item.slice(separator + 1).trim() : 'Ghi chú';
      return {
        index: columnIndex(column.trim(), 'note-cols'),
        label: label || 'Ghi chú',
      };
    });
}

function readTeachers(config) {
  const workbook = xlsx.readFile(config.inputPath, {
    cellDates: true,
    raw: true,
  });
  const sheetName = config.sheet || workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error(
      `Không tìm thấy sheet "${sheetName}". Các sheet hiện có: ${workbook.SheetNames.join(', ')}`,
    );
  }

  const rows = xlsx.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
    raw: true,
  });
  const teachers = [];

  for (
    let rowIndex = config.startRow - 1;
    rowIndex < rows.length;
    rowIndex += 1
  ) {
    const row = rows[rowIndex];
    const sttRaw = text(row[config.columns.stt]);
    const name = text(row[config.columns.name]).replace(/^(cô|thầy)\s+/i, '');
    if (!/^\d+$/.test(sttRaw) || !name) continue;

    const birthday = parseDate(
      config.columns.birthday === null ? null : row[config.columns.birthday],
    );
    const noteParts = config.noteColumns
      .map(({ index, label }) => {
        const noteValue = text(row[index]);
        return noteValue ? `${label}: ${noteValue}` : '';
      })
      .filter(Boolean);
    const classRole =
      config.columns.classRole === null
        ? ''
        : text(row[config.columns.classRole]);
    if (classRole) noteParts.unshift(`Lớp/Phân công: ${classRole}`);

    teachers.push({
      sourceRow: rowIndex + 1,
      stt: Number(sttRaw),
      name,
      gender:
        config.columns.gender === null
          ? null
          : parseGender(row[config.columns.gender]),
      birthday: birthday.value,
      birthdayDisplay: birthday.display,
      phone:
        config.columns.phone === null
          ? null
          : text(row[config.columns.phone]) || null,
      email:
        config.columns.email === null
          ? null
          : text(row[config.columns.email]).toLowerCase() || null,
      classRole,
      note: noteParts.join(' | ') || null,
    });
  }

  if (teachers.length === 0) {
    throw new Error(
      'Không đọc được giáo viên nào. Hãy kiểm tra --sheet, --start-row, --stt-col và --name-col.',
    );
  }

  const duplicateRows = [];
  const seenStt = new Set();
  for (const teacher of teachers) {
    if (seenStt.has(teacher.stt)) duplicateRows.push(teacher.sourceRow);
    seenStt.add(teacher.stt);
  }
  if (duplicateRows.length > 0) {
    throw new Error(`STT bị trùng tại dòng: ${duplicateRows.join(', ')}`);
  }

  return { teachers, sheetName };
}

function validateConfig(args) {
  const inputPath = path.resolve(required(args, 'input'));
  if (!fs.existsSync(inputPath)) {
    throw new Error(`File input không tồn tại: ${inputPath}`);
  }

  const groupCode = required(args, 'group');
  const prefix = usernamePart(required(args, 'prefix'));
  if (!prefix) throw new Error('--prefix không tạo được username hợp lệ');

  const startRow = Number(args['start-row'] || 1);
  if (!Number.isInteger(startRow) || startRow < 1) {
    throw new Error('--start-row phải là số nguyên lớn hơn hoặc bằng 1');
  }

  const outputPath = path.resolve(
    args.output || `exports/tai-khoan-gv-group${groupCode}.xlsx`,
  );
  if (args.commit && fs.existsSync(outputPath) && !args.overwrite) {
    throw new Error(
      `File output đã tồn tại: ${outputPath}. Dùng --overwrite nếu muốn ghi đè.`,
    );
  }

  return {
    inputPath,
    outputPath,
    groupCode,
    prefix,
    sheet: args.sheet,
    startRow,
    password: args.password || 'ichi123456',
    commit: Boolean(args.commit),
    allowExisting: Boolean(args['allow-existing']),
    columns: {
      stt: columnIndex(args['stt-col'] || 'A', 'stt-col'),
      name: columnIndex(args['name-col'] || 'B', 'name-col'),
      gender: columnIndex(args['gender-col'], 'gender-col'),
      birthday: columnIndex(args['birthday-col'], 'birthday-col'),
      phone: columnIndex(args['phone-col'], 'phone-col'),
      email: columnIndex(args['email-col'], 'email-col'),
      classRole: columnIndex(args['class-col'], 'class-col'),
    },
    noteColumns: parseNoteColumns(args['note-cols']),
  };
}

function nextUsername(prefix, name, usedUsernames) {
  const suffix = firstName(name);
  if (!suffix) throw new Error(`Không thể tạo username từ tên: ${name}`);

  const base = `${prefix}${suffix}`;
  let username = base;
  let counter = 2;
  while (usedUsernames.has(username)) {
    username = `${base}${counter}`;
    counter += 1;
  }
  usedUsernames.add(username);
  return username;
}

async function writeExport(outputPath, rows) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Teacher-Management System';
  workbook.created = new Date();
  const sheet = workbook.addWorksheet('Tài khoản giáo viên');
  sheet.columns = [
    { header: 'STT', key: 'stt', width: 8 },
    { header: 'Họ và tên', key: 'name', width: 30 },
    { header: 'Tên đăng nhập', key: 'username', width: 25 },
    { header: 'Mật khẩu', key: 'password', width: 18 },
    { header: 'Giới tính', key: 'gender', width: 12 },
    { header: 'Ngày sinh', key: 'birthday', width: 15 },
    { header: 'Số điện thoại', key: 'phone', width: 18 },
    { header: 'Email', key: 'email', width: 35 },
    { header: 'Lớp/Phân công', key: 'classRole', width: 22 },
    { header: 'Mã nhóm', key: 'groupCode', width: 12 },
    { header: 'Tên nhóm', key: 'groupName', width: 40 },
    { header: 'Ghi chú', key: 'note', width: 45 },
  ];
  sheet.addRows(rows);
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1F4E79' },
  };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = { from: 'A1', to: 'L1' };
  await workbook.xlsx.writeFile(outputPath);
}

function databaseConfig() {
  const requiredVariables = [
    'DB_HOST',
    'DB_PORT',
    'DB_USERNAME',
    'DB_PASSWORD',
    'DB_DATABASE',
  ];
  const missing = requiredVariables.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Thiếu biến môi trường DB: ${missing.join(', ')}`);
  }
  return {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  };
}

async function importTeachers(config, teachers) {
  const client = new Client(databaseConfig());
  await client.connect();
  let temporaryOutput = null;

  try {
    await client.query('BEGIN');
    const groupResult = await client.query(
      `SELECT id, code, name FROM public."group" WHERE code::text = $1 FOR UPDATE`,
      [config.groupCode],
    );
    if (!groupResult.rowCount) {
      throw new Error(`Không tìm thấy group có code = ${config.groupCode}`);
    }
    const group = groupResult.rows[0];

    const memberCountResult = await client.query(
      `SELECT COUNT(*)::int AS total
       FROM public.user_group ug
       JOIN public."user" u ON u.id = ug.user_id
       WHERE ug.group_id = $1 AND u.user_type = 'TEACHER'`,
      [group.id],
    );
    const existingTeacherCount = Number(memberCountResult.rows[0].total);
    if (existingTeacherCount > 0 && !config.allowExisting) {
      throw new Error(
        `Group ${group.code} đã có ${existingTeacherCount} giáo viên. Dùng --allow-existing nếu chắc chắn muốn import thêm.`,
      );
    }

    const existingUsernames = await client.query(
      `SELECT user_name FROM public."user"`,
    );
    const usedUsernames = new Set(
      existingUsernames.rows.map((row) => row.user_name),
    );
    const inputEmails = teachers
      .map((teacher) => teacher.email)
      .filter(Boolean);
    if (new Set(inputEmails).size !== inputEmails.length) {
      throw new Error('Email bị trùng trong file Excel');
    }
    if (inputEmails.length > 0) {
      const duplicateEmails = await client.query(
        `SELECT email FROM public."user" WHERE email = ANY($1::text[])`,
        [inputEmails],
      );
      if (duplicateEmails.rowCount) {
        throw new Error(
          `Email đã tồn tại trong DB: ${duplicateEmails.rows
            .map((row) => row.email)
            .join(', ')}`,
        );
      }
    }

    const hashPassword = await bcrypt.hash(config.password, 10);
    const createdRows = [];

    for (const teacher of teachers) {
      const username = nextUsername(config.prefix, teacher.name, usedUsernames);
      const userResult = await client.query(
        `INSERT INTO public."user" (
          user_name, hash_password, full_name, email, phone_number,
          birthday, gender, user_type, status, is_disabled, note
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'TEACHER', 'ACTIVE', false, $8)
        RETURNING id, user_name`,
        [
          username,
          hashPassword,
          teacher.name,
          teacher.email,
          teacher.phone,
          teacher.birthday,
          teacher.gender,
          teacher.note,
        ],
      );
      const user = userResult.rows[0];

      await client.query(
        `INSERT INTO public.user_group (group_id, user_id, role)
         VALUES ($1, $2, 'MEMBER')`,
        [group.id, user.id],
      );
      await client.query(
        `INSERT INTO public.teacher (code, name, email)
         VALUES ($1, $2, $3)`,
        [username, teacher.name, teacher.email || `${username}@local.invalid`],
      );

      createdRows.push({
        stt: teacher.stt,
        name: teacher.name,
        username,
        password: config.password,
        gender:
          teacher.gender === 'FEMALE'
            ? 'Nữ'
            : teacher.gender === 'MALE'
              ? 'Nam'
              : '',
        birthday: teacher.birthdayDisplay,
        phone: teacher.phone || '',
        email: teacher.email || '',
        classRole: teacher.classRole,
        groupCode: group.code,
        groupName: group.name,
        note: teacher.note || '',
      });
    }

    const verification = await client.query(
      `SELECT COUNT(*)::int AS total
       FROM public.user_group ug
       JOIN public."user" u ON u.id = ug.user_id
       WHERE ug.group_id = $1
         AND u.user_name = ANY($2::text[])
         AND u.user_type = 'TEACHER'`,
      [group.id, createdRows.map((row) => row.username)],
    );
    if (Number(verification.rows[0].total) !== createdRows.length) {
      throw new Error('Số giáo viên xác minh sau import không khớp');
    }

    if (!config.commit) {
      await client.query('ROLLBACK');
      return { group, createdRows, committed: false };
    }

    temporaryOutput = `${config.outputPath}.${process.pid}.tmp.xlsx`;
    await writeExport(temporaryOutput, createdRows);
    await client.query('COMMIT');

    if (fs.existsSync(config.outputPath)) fs.unlinkSync(config.outputPath);
    fs.renameSync(temporaryOutput, config.outputPath);
    temporaryOutput = null;
    return { group, createdRows, committed: true };
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Transaction có thể đã kết thúc; giữ nguyên lỗi gốc.
    }
    if (temporaryOutput && fs.existsSync(temporaryOutput)) {
      fs.unlinkSync(temporaryOutput);
    }
    throw error;
  } finally {
    await client.end();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(HELP.trim());
    return;
  }

  const config = validateConfig(args);
  const { teachers, sheetName } = readTeachers(config);
  console.log(`File: ${config.inputPath}`);
  console.log(`Sheet: ${sheetName}`);
  console.log(`Đã đọc: ${teachers.length} giáo viên`);
  console.log(
    `Chế độ: ${config.commit ? 'IMPORT THẬT' : 'XEM TRƯỚC (ROLLBACK)'}`,
  );

  const result = await importTeachers(config, teachers);
  console.log(`Group: [${result.group.code}] ${result.group.name}`);
  console.log(`Tổng giáo viên hợp lệ: ${result.createdRows.length}`);
  console.table(
    result.createdRows.slice(0, 10).map((row) => ({
      stt: row.stt,
      name: row.name,
      username: row.username,
    })),
  );

  if (result.committed) {
    console.log(`Import thành công và đã xuất: ${config.outputPath}`);
  } else {
    console.log(
      'Xem trước thành công; DB không thay đổi. Thêm --commit để import thật.',
    );
  }
}

main().catch((error) => {
  console.error(`IMPORT THẤT BẠI: ${error.message}`);
  process.exitCode = 1;
});
