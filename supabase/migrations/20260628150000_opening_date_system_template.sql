-- =============================================================================
-- M_HP_X.1 — "Opening date" (bontas) promoted to a real, per-account system template.
--
-- Replaces the client-side virtual BontasCard (synthetic id "bontas-fixed") with a
-- real DB template so external apps (Planivo HUB) can print it via POST /print like
-- any other template, and so it is returned by GET /templates.
--
-- HACCPrint is single-tenant per auth user → there is ONE system template PER ACCOUNT
-- (not a global one), each scoped on user_id / account_id like everything else.
--
-- Decisions (approved):
--  • name  = 'Bontás napja' FIXED (option 1B) — printed header is template.name; no
--    per-language override. Clients are Hungarian for v1.
--  • category = 'System' — NOT NULL placeholder; the renderer does NOT draw category,
--    and the template is hidden from the grid, so this value is internal-only and must
--    not collide with the user's real Hungarian categories.
--  • shelf_life_days = 0 — for 'bontas' the renderer prints only "Opened: <date>"
--    (no use-by); the listener logs expiry_date = prepared_date, matching the old
--    synthetic behavior.
--  • is_system_template = true — marker for UI guardrails (hide from grid / Edit /
--    Delete / UnassignedLabelsPanel). NO RLS hard-block in this task (handled later).
--  • Backfill: ALL auth.users. Visibility: only ACTIVE connections (revoked_at IS NULL).
--  • Future accounts: trigger on auth.users. Future connections: trigger on connected_apps.
--
-- All changes are additive / idempotent (NOT EXISTS / ON CONFLICT) and backward-compatible.
-- =============================================================================

-- (a) Marker column. Additive, defaulted → existing rows stay user templates.
ALTER TABLE templates
  ADD COLUMN IF NOT EXISTS is_system_template boolean NOT NULL DEFAULT false;

-- (b) Backfill: one system 'bontas' template per existing account. Idempotent.
INSERT INTO templates (user_id, name, type, category, shelf_life_days, is_system_template)
SELECT u.id, 'Bontás napja', 'bontas', 'System', 0, true
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM templates t
  WHERE t.user_id = u.id AND t.is_system_template = true
);

-- (c) Backfill visibility: assign each account's system template to its ACTIVE
--     connections only. PK (template_id, connected_app_id) makes this idempotent.
INSERT INTO template_visibility (template_id, connected_app_id, account_id)
SELECT t.id, ca.id, ca.account_id
FROM connected_apps ca
JOIN templates t
  ON t.user_id = ca.account_id AND t.is_system_template = true
WHERE ca.revoked_at IS NULL
ON CONFLICT (template_id, connected_app_id) DO NOTHING;

-- (d) Trigger: auto-assign the account's system template to every NEW connection.
--     SECURITY DEFINER so it can write template_visibility regardless of caller RLS
--     (the /connect edge function already uses service_role, but this keeps the trigger
--     correct under any insert path).
CREATE OR REPLACE FUNCTION assign_system_template_to_connection()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO template_visibility (template_id, connected_app_id, account_id)
  SELECT t.id, NEW.id, NEW.account_id
  FROM templates t
  WHERE t.user_id = NEW.account_id AND t.is_system_template = true
  ON CONFLICT (template_id, connected_app_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_system_template ON connected_apps;
CREATE TRIGGER trg_assign_system_template
  AFTER INSERT ON connected_apps
  FOR EACH ROW
  EXECUTE FUNCTION assign_system_template_to_connection();

-- (e) Trigger: create the system template for every NEW account. SECURITY DEFINER so
--     it can insert into public.templates from the auth.users insert path.
CREATE OR REPLACE FUNCTION create_system_template_for_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO templates (user_id, name, type, category, shelf_life_days, is_system_template)
  SELECT NEW.id, 'Bontás napja', 'bontas', 'System', 0, true
  WHERE NOT EXISTS (
    SELECT 1 FROM templates t
    WHERE t.user_id = NEW.id AND t.is_system_template = true
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_system_template ON auth.users;
CREATE TRIGGER trg_create_system_template
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_system_template_for_user();
