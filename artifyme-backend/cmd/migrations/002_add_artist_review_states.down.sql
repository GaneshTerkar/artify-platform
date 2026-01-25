ALTER TABLE artist_profiles
DROP COLUMN IF EXISTS rejected_reason,
DROP COLUMN IF EXISTS rejected_at;
