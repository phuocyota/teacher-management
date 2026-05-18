# Agent Import Guide

Huong dan nay dung cho viec import danh sach hoc sinh tu file Excel vao DB cua project `teacher-management`.

## Muc tieu

Import mot truong tieu hoc gom:

- `school`
- `student_group` theo lop
- `user` loai `STUDENT`
- `student` lien ket voi `user`, `school`, `student_group`
- file Excel tai khoan xuat ra trong thu muc `exports/`

Mat khau mac dinh cho hoc sinh: `123456`.

## Bang lien quan

- `zone`: khu vuc, vi du `VT` la `Vung Tau`.
- `school`: truong, co `zone_id`.
- `student_group`: lop hoc, cot school la `"schoolId"` dang camelCase.
- `"user"`: tai khoan dang nhap.
- `student`: ho so hoc sinh, dung cung `id` voi `"user".id`.

## Truoc khi import

Kiem tra file ton tai:

```bash
node - <<'NODE'
const fs = require('fs');
const p = '/path/to/file.xlsx';
console.log(fs.existsSync(p), p, fs.existsSync(p) ? fs.statSync(p).size : '');
NODE
```

Kiem tra zone va truong da ton tai:

```bash
node -r dotenv/config - <<'NODE'
const { Client } = require('pg');

(async () => {
  const c = new Client({
    host: process.env.DB_HOST,
    port: +process.env.DB_PORT,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  });
  await c.connect();

  const zones = await c.query(
    `select id, code, name from zone where code = 'VT'`
  );
  console.log('zones', zones.rows);

  const schools = await c.query(
    `select s.id, s.code, s.name, z.name zone
     from school s
     left join zone z on z.id = s.zone_id
     where lower(unaccent(s.name)) like lower(unaccent($1))
        or s.code ilike $2`,
    ['%ten truong khong dau%', '%SCHOOL_CODE%']
  );
  console.log('schools', schools.rows);

  await c.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
NODE
```

## Doc nhanh cau truc Excel

Dung `exceljs` voi file `.xlsx`:

```bash
node - <<'NODE'
const ExcelJS = require('exceljs');

function txt(cell) {
  const v = cell.value;
  if (v == null) return '';
  if (typeof v === 'object' && v.richText) return v.richText.map((x) => x.text).join('');
  if (typeof v === 'object' && v.text) return v.text;
  if (typeof v === 'object' && v.result != null) return String(v.result);
  return String(v);
}

(async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile('/path/to/file.xlsx');

  console.log(wb.worksheets.map((ws) => `${ws.name}:${ws.rowCount}x${ws.columnCount}`).join('\n'));

  for (const ws of wb.worksheets) {
    console.log('---', ws.name);
    for (let r = 1; r <= Math.min(12, ws.rowCount); r++) {
      const vals = [];
      ws.getRow(r).eachCell({ includeEmpty: true }, (cell, col) => {
        vals[col - 1] = txt(cell);
      });
      console.log(r, JSON.stringify(vals));
    }
  }
})();
NODE
```

Voi file `.xls` cu, tao virtualenv tam va dung `xlrd`:

```bash
python3 -m venv .venv-xls
.venv-xls/bin/pip install xlrd
.venv-xls/bin/python - <<'PY'
import xlrd
p = '/path/to/file.xls'
book = xlrd.open_workbook(p)
print([(s.name, s.nrows, s.ncols) for s in book.sheets()])
PY
rm -rf .venv-xls
```

## Quy tac parse hoc sinh

Thuong gap:

- Cot A la `STT`.
- Cot B la `Ho ten`.
- Ten lop nam o ten sheet hoac cot lop.
- Header co the lap lai nhieu dong.
- Mot so workbook co sheet sai truong, vi du file Long Huong/Kim Dinh co sheet `2.2` ghi `TRUONG TIEU HOC KIM DONG`. Phai bo qua sheet sai truong.

Dieu kien lay hoc sinh nen la:

- `STT` la so: `/^\d+$/`
- Ho ten khong rong
- Ho ten khong phai header `HO VA TEN...`
- Neu can, chi include sheet co dong truong dung o row 2.

Ham normalize:

```js
function norm(s) {
  return (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}
```

## Quy uoc ma

Da dung trong cac lan import gan day:

- Tieu hoc Truong Cong Dinh: `TH_TRUONG_CONG_DINH`, username `thtcd_11_001`.
- Tieu hoc Kim Dinh: `TH_KIM_DINH`, username `thkd_1a1_001`.
- Tieu hoc Long Huong: `TH_LONG_HUONG`, username `thlh_1a1_001`.
- Tieu hoc Le Loi: `TH_LE_LOI`, username `thll_1a_001`.
- Tieu hoc Luu Chi Hieu: `TH_LUU_CHI_HIEU`, username `thlch_1a1_001`.

Voi lop dang `1A1`, `2A4`, dung:

- `student_group.code`: `101`, `204`, ...
- `student_group.name`: `Lop 1A1`, `Lop 2A4`, ...
- username: `<prefix>_<class lowercase>_<stt 3 so>`

Voi lop dang `1.1`, `5.6`, dung:

- `student_group.code`: `11`, `56`
- `student_group.name`: `Lop 1.1`, `Lop 5.6`
- username: `<prefix>_11_001`, `<prefix>_56_001`

## Import transaction mau

Chinh cac bien:

- `input`
- `schoolCode`
- `schoolName`
- `zoneCode`
- `prefix`
- `isTargetSchool`
- `classCode`

Luu y `schoolName` la ten hien thi luc tao truong, nen viet dung hoa thuong va dau tieng Viet neu co. Vi du dung `THCS Nguyễn An Khương`, khong dung `THCS NGUYỄN AN KHƯƠNG`.

```bash
node -r dotenv/config - <<'NODE'
const ExcelJS = require('exceljs');
const { Client } = require('pg');
const bcrypt = require('bcryptjs');

const input = '/path/to/file.xlsx';
const schoolCode = 'TH_EXAMPLE';
const schoolName = 'THCS Nguyễn An Khương';
const zoneCode = 'VT';
const prefix = 'thex';

function txt(cell) {
  const v = cell.value;
  if (v == null) return '';
  if (typeof v === 'object' && v.richText) return v.richText.map((x) => x.text).join('');
  if (typeof v === 'object' && v.text) return v.text;
  if (typeof v === 'object' && v.result != null) return String(v.result);
  return String(v);
}

function norm(s) {
  return (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

function isHeaderName(name) {
  return norm(name).includes('ho va ten');
}

function classCode(cls) {
  let m = cls.match(/^(\d+)A(\d+)$/i);
  if (m) return Number(m[1]) * 100 + Number(m[2]);

  m = cls.match(/^(\d+)\.(\d+)$/);
  if (m) return Number(m[1]) * 10 + Number(m[2]);

  throw new Error(`Bad class ${cls}`);
}

function usernameFor(cls, index) {
  const normalizedClass = cls.toLowerCase().replace('.', '');
  return `${prefix}_${normalizedClass}_${String(index).padStart(3, '0')}`;
}

function isTargetSchool(ws) {
  return norm(txt(ws.getRow(2).getCell(1))).includes('example');
}

(async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(input);

  const byClass = new Map();
  for (const ws of wb.worksheets) {
    if (!isTargetSchool(ws)) continue;

    const names = [];
    for (let r = 1; r <= ws.rowCount; r++) {
      const stt = txt(ws.getRow(r).getCell(1)).trim();
      const name = txt(ws.getRow(r).getCell(2)).trim().replace(/\s+/g, ' ');
      if (/^\d+$/.test(stt) && name && !isHeaderName(name)) {
        names.push(name);
      }
    }

    byClass.set(ws.name, names);
  }

  const client = new Client({
    host: process.env.DB_HOST,
    port: +process.env.DB_PORT,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  });
  await client.connect();

  try {
    await client.query('begin');

    const zone = (await client.query(
      `select id from zone where code = $1`,
      [zoneCode]
    )).rows[0];
    if (!zone) throw new Error(`Khong tim thay zone ${zoneCode}`);

    const exists = await client.query(
      `select id from school where code = $1 for update`,
      [schoolCode]
    );
    if (exists.rowCount) throw new Error(`Truong ${schoolCode} da ton tai`);

    const school = (await client.query(
      `insert into school(code, name, zone_id)
       values($1, $2, $3)
       returning id, code, name, zone_id`,
      [schoolCode, schoolName, zone.id]
    )).rows[0];

    const hash = await bcrypt.hash('123456', 10);
    let inserted = 0;

    for (const [cls, names] of byClass.entries()) {
      const group = (await client.query(
        `insert into student_group(code, name, "schoolId", role)
         values($1, $2, $3, $4)
         returning id`,
        [classCode(cls), `Lop ${cls}`, school.id, 'MEMBER']
      )).rows[0];

      const rows = names.map((name, i) => ({
        code: usernameFor(cls, i + 1),
        name,
      }));

      const users = (await client.query(
        `insert into "user"(user_name, hash_password, full_name, user_type, status, is_disabled)
         select r.code, $2, r.name, 'STUDENT', 'ACTIVE', false
         from jsonb_to_recordset($1::jsonb) as r(code text, name text)
         returning id, user_name`,
        [JSON.stringify(rows), hash]
      )).rows;

      const studentRows = users.map((user) => ({
        id: user.id,
        code: user.user_name,
      }));

      await client.query(
        `insert into student(id, student_group_id, school_id, code)
         select r.id::uuid, $2, $3, r.code
         from jsonb_to_recordset($1::jsonb) as r(id text, code text)`,
        [JSON.stringify(studentRows), group.id, school.id]
      );

      inserted += names.length;
    }

    await client.query('commit');
    console.log({ school, classes: byClass.size, students: inserted });
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    await client.end();
  }
})();
NODE
```

### Neu import cham

Doan transaction mau o tren da dung bulk insert theo tung lop. Neu ban dang dung script cu voi vong lap:

```js
for (...) {
  await client.query('insert into "user" ... returning id');
  await client.query('insert into student ...');
}
```

thi toc do se cham vi moi hoc sinh ton 2 round-trip toi PostgreSQL. Voi 1.000 hoc sinh la khoang 2.000 query tuan tu. Nen chuyen sang pattern `jsonb_to_recordset` nhu tren:

- Hash mat khau mot lan: `const hash = await bcrypt.hash(password, 10)`.
- Insert nhieu `"user"` trong mot query va `returning id, user_name`.
- Insert nhieu `student` trong mot query tu danh sach id vua tra ve.
- Van giu transaction de rollback toan bo neu co loi.

Co the bulk toan truong nhanh hon nua, nhung bulk theo tung lop de doc, de debug va van nhanh hon rat nhieu so voi insert tung hoc sinh.

## Doi username sau import

Neu can doi format username, phai update ca `"user".user_name` va `student.code` trong cung transaction.

Vi du doi Truong Cong Dinh tu `TCD-11-001` sang `thtcd_11_001`:

```sql
-- Lam bang script Node de mapping tung dong, khong update tay hang loat neu chua check duplicate.
update "user" set user_name = $1 where user_name = $2;
update student set code = $1 where id = $2;
```

Luon check:

- username moi co trung khong
- so dong update dung voi tong hoc sinh
- `student.code = user.user_name`

## Xuat file tai khoan

```bash
node -r dotenv/config - <<'NODE'
const { Client } = require('pg');
const ExcelJS = require('exceljs');
const path = require('path');

const schoolCode = 'TH_EXAMPLE';
const output = 'exports/hoc-sinh-th-example-tai-khoan.xlsx';

(async () => {
  const c = new Client({
    host: process.env.DB_HOST,
    port: +process.env.DB_PORT,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  });
  await c.connect();

  const school = (await c.query(
    `select s.id, s.code, s.name, z.name zone
     from school s
     left join zone z on z.id = s.zone_id
     where s.code = $1`,
    [schoolCode]
  )).rows[0];

  const counts = (await c.query(
    `select sg.code, sg.name, count(st.id)::int total
     from student_group sg
     left join student st on st.student_group_id = sg.id
     where sg."schoolId" = $1
     group by sg.id
     order by sg.code`,
    [school.id]
  )).rows;

  const rows = (await c.query(
    `select sg.name as class, u.full_name as name, st.code
     from student st
     join "user" u on u.user_name = st.code
     join student_group sg on sg.id = st.student_group_id
     where sg."schoolId" = $1
     order by sg.code, st.code`,
    [school.id]
  )).rows;

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Codex';
  wb.created = new Date();

  const ws = wb.addWorksheet('Tai khoan hoc sinh');
  ws.columns = [
    { header: 'Lop', key: 'class', width: 12 },
    { header: 'Ho ten', key: 'name', width: 32 },
    { header: 'Tai khoan', key: 'code', width: 18 },
    { header: 'Mat khau', key: 'password', width: 12 },
  ];
  ws.addRows(rows.map((r) => ({ ...r, password: '123456' })));
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  const sm = wb.addWorksheet('Tom tat');
  sm.addRows([
    ['Truong', school.name],
    ['Ma truong', school.code],
    ['Zone', school.zone],
    ['Tong lop', counts.length],
    ['Tong hoc sinh', rows.length],
    ['Mat khau chung', '123456'],
    [],
    ['Lop', 'So hoc sinh'],
  ]);
  for (const r of counts) sm.addRow([r.name, r.total]);
  sm.getRow(1).font = { bold: true };
  sm.getRow(8).font = { bold: true };

  const out = path.resolve(output);
  await wb.xlsx.writeFile(out);
  console.log(out);

  await c.end();
})();
NODE
```

## Checklist sau import

Chay cac kiem tra nay:

- Tong lop dung.
- Tong hoc sinh dung.
- `badFormat = 0` neu co quy tac username.
- `student.code` join duoc voi `"user".user_name`.
- File xuat nam trong `exports/`.

Kiem tra join user/student:

```sql
select count(*) total, count(u.id) with_user
from student st
join student_group sg on sg.id = st.student_group_id
left join "user" u on u.user_name = st.code
where sg."schoolId" = $1;
```

Neu `with_user` nho hon `total`, file xuat theo join user se thieu dong. Can sua du lieu hoac xuat theo `student` voi ten rong cho cac dong chua co user.

## Luu y quan trong

- Khong import sheet co ten truong khac voi yeu cau, ke ca nam trong cung workbook.
- Khong doan file bat dau tu row nao. Hay parse theo cot `STT` la so.
- Luon dung transaction va rollback khi co loi.
- Khong update destructively hay xoa data cu neu user khong yeu cau.
- Neu workbook dang mo, co the xuat hien file tam `~$...`; khong can commit/xu ly file tam do.
