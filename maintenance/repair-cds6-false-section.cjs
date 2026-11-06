// Dry-run by default. Use --apply only after reviewing the exact repair scope.
require('dotenv').config({ quiet: true });
const assert = require('node:assert/strict');
const { Client } = require('pg');

const BANK_ID = '9dab69da-a17e-4b85-9fef-f2fdc60e05fe';
const SECTION_ID = 'f2be7d44-0302-4863-8dd7-bca41aee7fa9';
const QUESTION_ID = '70c88718-f3e9-44f5-bbb8-ef9fcb37cd48';
const ANSWER_C_ID = '6ff44dc4-ef44-447b-8548-83a34ba8107b';
const TITLE = 'phân loại rác thải đúng nơi quy định.';
const ORIGINAL_C = 'Tham gia các hoạt động tuyên truyền bảo vệ nguồn nước, dọn dẹp vệ sinh và';
const ANSWER_D = 'Lấy nước suối đó về dùng trực tiếp cho sinh hoạt gia đình.';

async function main() {
  const apply = process.argv.includes('--apply');
  const client = new Client({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    connectionTimeoutMillis: 8000,
  });
  try {
    await client.connect();
    if (apply) {
      const privileges = (await client.query(
        `SELECT has_table_privilege(current_user,'question_bank_section','DELETE') AS can_delete`,
      )).rows[0];
      assert.equal(privileges.can_delete, true, 'Database role needs DELETE on question_bank_section');
    }
    await client.query(apply ? 'BEGIN' : 'BEGIN READ ONLY');
    await client.query("SET LOCAL lock_timeout = '5s'");
    if (apply) await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [BANK_ID]);
    const lock = apply ? ' FOR UPDATE' : '';
    const sections = (await client.query(
      'SELECT * FROM question_bank_section WHERE question_bank_id=$1' + lock,
      [BANK_ID],
    )).rows;
    assert.equal(sections.length, 1, 'Expected exactly one false section');
    const section = sections[0];
    assert.equal(section.id, SECTION_ID);
    assert.equal(section.title, TITLE);
    assert.equal(section.order_no, 50);
    assert.equal(section.meta, null);
    assert.equal(section.instruction.replace(/\s+/g, ' ').trim(), `D. ${ANSWER_D}`);

    const links = (await client.query(
      'SELECT * FROM question_bank_question WHERE question_bank_id=$1 ORDER BY order_no' + lock,
      [BANK_ID],
    )).rows;
    assert.equal(links.length, 10);
    assert.deepEqual(links.filter(l => l.section_id === SECTION_ID).map(l => l.order_no), [5, 6, 7, 8, 9, 10]);
    assert.equal(links.find(l => l.order_no === 4)?.question_id, QUESTION_ID);
    const usage = await client.query('SELECT count(*)::int AS count FROM question_bank_question WHERE question_id=$1', [QUESTION_ID]);
    assert.equal(usage.rows[0].count, 1, 'Question must belong only to this bank');
    const answers = (await client.query('SELECT * FROM answer WHERE "questionId"=$1' + lock, [QUESTION_ID])).rows;
    assert.equal(answers.length, 3);
    assert.deepEqual(answers.map(a => a.meta?.importOptionLabel).sort(), ['A', 'B', 'C']);
    const answerC = answers.find(a => a.id === ANSWER_C_ID);
    assert.equal(answerC?.content, ORIGINAL_C);
    assert.equal(answerC?.nextContent, null);
    assert.equal(answerC?.meta?.isCorrect, true);

    if (!apply) {
      console.log(JSON.stringify({
        mode: 'read-only preview', bankId: BANK_ID,
        before: { sections: 1, questions: 10, grouped_questions: 6, question4_answers: 3 },
        expectedAfter: { sections: 0, questions: 10, grouped_questions: 0, question4_answers: 4 },
        restoredC: `${ORIGINAL_C} ${TITLE}`, restoredD: ANSWER_D,
        operations: ['Restore answer C', 'Insert missing answer D', 'Unlink questions 5-10 from false section', 'Delete only the false section'],
      }, null, 2));
      await client.query('ROLLBACK');
      console.log('Preview only. No changes saved.');
      return;
    }

    const fixedC = await client.query('UPDATE answer SET content=$1 WHERE id=$2', [`${ORIGINAL_C} ${TITLE}`, ANSWER_C_ID]);
    assert.equal(fixedC.rowCount, 1);
    await client.query(
      `INSERT INTO answer ("questionId", content, content_type, order_no, is_correct, meta)
       VALUES ($1,$2,'TEXT',0,false,$3::jsonb)`,
      [QUESTION_ID, ANSWER_D, JSON.stringify({ importOptionLabel: 'D' })],
    );
    const unlinked = await client.query('UPDATE question_bank_question SET section_id=NULL WHERE question_bank_id=$1 AND section_id=$2', [BANK_ID, SECTION_ID]);
    assert.equal(unlinked.rowCount, 6);
    const removed = await client.query('DELETE FROM question_bank_section WHERE id=$1 AND question_bank_id=$2', [SECTION_ID, BANK_ID]);
    assert.equal(removed.rowCount, 1);
    const after = (await client.query(
      `SELECT
         (SELECT count(*)::int FROM question_bank_section WHERE question_bank_id=$1) AS sections,
         (SELECT count(*)::int FROM question_bank_question WHERE question_bank_id=$1) AS questions,
         (SELECT count(*)::int FROM question_bank_question WHERE question_bank_id=$1 AND section_id IS NOT NULL) AS grouped_questions,
         (SELECT count(*)::int FROM answer WHERE "questionId"=$2) AS question4_answers`,
      [BANK_ID, QUESTION_ID],
    )).rows[0];
    assert.deepEqual(after, { sections: 0, questions: 10, grouped_questions: 0, question4_answers: 4 });
    console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', bankId: BANK_ID, before: { sections: 1, questions: 10, grouped_questions: 6, question4_answers: 3 }, after, restoredC: `${ORIGINAL_C} ${TITLE}`, restoredD: ANSWER_D }, null, 2));
    await client.query(apply ? 'COMMIT' : 'ROLLBACK');
    console.log(apply ? 'Committed.' : 'Rolled back. No changes saved.');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

main().catch(error => {
  console.error(error.code || error.name, error instanceof assert.AssertionError ? error.message : 'Repair failed; transaction rolled back.');
  process.exitCode = 1;
});
