-- =============================================================================
-- M5 — Rate limiting for edge functions.
--
-- Single generic table + atomic function, used for two buckets:
--   * 'connect_ip' → /connect, keyed by client IP (brute-force protection)
--   * 'token'      → /templates & /print, keyed by token_hash
--
-- Deviation from the plan's dedicated `rate_limit_connect`: one generic table
-- serves both cases with the same pattern. Only edge functions (service_role)
-- touch it; RLS is enabled with no policy so owner/anon access is denied.
-- =============================================================================

CREATE TABLE api_rate_limits (
  bucket        text NOT NULL,             -- 'connect_ip' | 'token'
  key           text NOT NULL,             -- IP address or token_hash
  count         int  NOT NULL DEFAULT 0,
  window_start  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (bucket, key)
);

ALTER TABLE api_rate_limits ENABLE ROW LEVEL SECURITY;
-- No policy on purpose: service_role bypasses RLS; everyone else is denied.

-- Atomic fixed-window rate limiter.
-- Returns TRUE if the request is allowed, FALSE if the limit is exceeded.
-- Lazily cleans up stale rows (older than 1 hour) on every call.
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_bucket          text,
  p_key             text,
  p_limit           int,
  p_window_seconds  int
) RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  v_count        int;
  v_window_start timestamptz;
BEGIN
  -- Lazy cleanup of stale buckets.
  DELETE FROM api_rate_limits WHERE window_start < now() - interval '1 hour';

  SELECT count, window_start
    INTO v_count, v_window_start
    FROM api_rate_limits
   WHERE bucket = p_bucket AND key = p_key
   FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO api_rate_limits (bucket, key, count, window_start)
    VALUES (p_bucket, p_key, 1, now());
    RETURN true;
  END IF;

  -- Window expired → reset.
  IF v_window_start < now() - make_interval(secs => p_window_seconds) THEN
    UPDATE api_rate_limits
       SET count = 1, window_start = now()
     WHERE bucket = p_bucket AND key = p_key;
    RETURN true;
  END IF;

  -- Over the limit within the active window.
  IF v_count >= p_limit THEN
    RETURN false;
  END IF;

  UPDATE api_rate_limits
     SET count = count + 1
   WHERE bucket = p_bucket AND key = p_key;
  RETURN true;
END;
$$;
