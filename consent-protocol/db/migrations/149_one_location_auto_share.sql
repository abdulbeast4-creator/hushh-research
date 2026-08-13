-- Migration 149: persist the One Location "Auto-share my location" preference
-- =========================================================================
-- The Auto-share toggle previously lived only in browser localStorage, so it
-- could change how NEW manual shares behaved but could never actually create a
-- share. Turning it on did nothing on its own, and it could not auto-start a
-- share when a new connection or Circle member arrived later.
--
-- This column is the owner-scoped, server-side source of truth for that toggle.
-- It lives on the existing coordinate-free owner-preferences table
-- (one_location_map_preferences) beside presence_mode, so no coordinate ever
-- touches it. It defaults to TRUE to match the shipped frontend default
-- (OneLocationControlState.autoShareEnabled = true).
--
-- The flag only governs the auto-share fan-out; it never widens who is eligible
-- to receive location. Every auto-created grant is still an explicit,
-- relationship-gated one_location_share_grants row tagged metadata.source =
-- 'auto_share' so toggling the flag off tears down ONLY those rows and never a
-- manually created share.

BEGIN;

ALTER TABLE one_location_map_preferences
  ADD COLUMN IF NOT EXISTS auto_share_enabled BOOLEAN NOT NULL DEFAULT TRUE;

-- Auto-share teardown revokes grants by owner + metadata source marker. This
-- partial index keeps that revoke (and the "does an auto-share grant already
-- exist?" idempotency probe in fan-out) from scanning every active grant.
CREATE INDEX IF NOT EXISTS idx_one_location_share_grants_auto_share_active
  ON one_location_share_grants (owner_user_id)
  WHERE status = 'active' AND metadata->>'source' = 'auto_share';

COMMENT ON COLUMN one_location_map_preferences.auto_share_enabled IS
  'Owner opt-in for auto-sharing live location with every location-eligible connection and Circle member. Governs the auto_share grant fan-out only; never widens recipient eligibility.';

COMMIT;
