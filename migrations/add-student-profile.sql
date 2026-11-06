-- Additive change: existing students keep NULL profile values.
BEGIN;
ALTER TABLE student ADD COLUMN IF NOT EXISTS full_name varchar(255);
ALTER TABLE student ADD COLUMN IF NOT EXISTS image varchar(2048);
ALTER TABLE student ADD COLUMN IF NOT EXISTS phone varchar(24);
COMMIT;
