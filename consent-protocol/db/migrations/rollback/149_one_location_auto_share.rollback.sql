-- Rollback for migration 149: One Location auto-share preference.
-- Drops the additive column and its supporting partial index. This is safe
-- because the flag governs only the auto_share grant fan-out; existing
-- manually created grants are untouched by removing the preference column.

BEGIN;

DROP INDEX IF EXISTS idx_one_location_share_grants_auto_share_active;

ALTER TABLE one_location_map_preferences
  DROP COLUMN IF EXISTS auto_share_enabled;

COMMIT;
