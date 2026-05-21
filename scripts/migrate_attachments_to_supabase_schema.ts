import { db } from '../server/db';
import { sql } from 'drizzle-orm';

const run = async () => {
  await db.execute(sql.raw(`
    ALTER TABLE journal_attachments
      ADD COLUMN IF NOT EXISTS file_path TEXT,
      ADD COLUMN IF NOT EXISTS download_url TEXT;
  `));
  await db.execute(sql.raw(`ALTER TABLE journal_attachments ALTER COLUMN file_data DROP NOT NULL;`));
  const check = await db.execute(sql.raw(`
    SELECT column_name, is_nullable, data_type
    FROM information_schema.columns
    WHERE table_name='journal_attachments'
      AND column_name IN ('file_data','file_path','download_url')
    ORDER BY column_name;
  `));
  console.log('Migration OK');
  console.log(JSON.stringify((check as any).rows ?? check, null, 2));
  process.exit(0);
};
run().catch(e => { console.error('FAIL:', e); process.exit(1); });
