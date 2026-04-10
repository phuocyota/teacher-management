const { Client } = require('pg');
require('dotenv').config();

async function main() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_DATABASE,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
  });

  await client.connect();

  try {
    const result = await client.query(`
      INSERT INTO exam_set_class (
        exam_set_id,
        class_id,
        created_at,
        updated_at
      )
      SELECT
        es.id,
        es.class_id,
        NOW(),
        NOW()
      FROM exam_set es
      WHERE es.class_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM exam_set_class esc
          WHERE esc.exam_set_id = es.id
            AND esc.class_id = es.class_id
        )
    `);

    const counts = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM exam_set_class) AS exam_set_class_count,
        (SELECT COUNT(*) FROM exam_set WHERE class_id IS NOT NULL) AS exam_set_with_legacy_class_count
    `);

    console.log(
      JSON.stringify(
        {
          insertedRows: result.rowCount ?? 0,
          ...counts.rows[0],
        },
        null,
        2,
      ),
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
