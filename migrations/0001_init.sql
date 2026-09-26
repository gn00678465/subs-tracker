-- 單一使用者：settings 只有一列
CREATE TABLE settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  admin_username TEXT NOT NULL,
  -- HMAC-SHA256，金鑰是 jwt_secret，兩者必須在同一列
  admin_password_hash TEXT NOT NULL,
  jwt_secret TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  reminder_hour INTEGER NOT NULL CHECK (reminder_hour BETWEEN 0 AND 23),
  reminder_mode TEXT NOT NULL DEFAULT 'ONCE' CHECK (reminder_mode IN ('ONCE', 'DAILY')),
  default_reminder_days INTEGER NOT NULL DEFAULT 3 CHECK (default_reminder_days BETWEEN 1 AND 365),
  webauthn_user_handle TEXT,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE notification_channels (
  channel TEXT PRIMARY KEY CHECK (channel IN ('telegram', 'email', 'webhook', 'bark')),
  enabled INTEGER NOT NULL DEFAULT 0,
  -- JSON，使用者寫入；last_* 只由 Cron 寫入
  config TEXT NOT NULL DEFAULT '{}',
  last_status TEXT CHECK (last_status IN ('ok', 'failed')),
  last_error TEXT,
  last_attempt_at TEXT,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE subscriptions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  currency TEXT NOT NULL,
  price REAL NOT NULL CHECK (price >= 0),
  period_value INTEGER NOT NULL CHECK (period_value >= 1),
  period_unit TEXT NOT NULL CHECK (period_unit IN ('day', 'week', 'month', 'year')),
  start_date TEXT,
  expiry_date TEXT NOT NULL,
  cancel_by_date TEXT,
  auto_renew INTEGER NOT NULL,
  is_free_trial INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  reminder_kind TEXT NOT NULL DEFAULT 'default' CHECK (reminder_kind IN ('default', 'off', 'days')),
  reminder_days INTEGER CHECK (reminder_days BETWEEN 1 AND 365),
  payment_method TEXT NOT NULL DEFAULT '',
  website TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  last_reminder_sent_at TEXT,
  last_checked_expiry_date TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK ((reminder_kind = 'days') = (reminder_days IS NOT NULL))
) STRICT;

CREATE TABLE reminder_deliveries (
  subscription_id TEXT NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  local_date TEXT NOT NULL,
  channel TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed')),
  error TEXT,
  attempted_at TEXT NOT NULL,
  PRIMARY KEY (subscription_id, local_date, channel)
) STRICT;

CREATE TABLE cron_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  local_date TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  reminded INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  error TEXT
) STRICT;

CREATE TABLE passkey_credentials (
  id TEXT PRIMARY KEY,
  public_key TEXT NOT NULL,
  counter INTEGER NOT NULL DEFAULT 0,
  transports TEXT NOT NULL DEFAULT '[]',
  rp_id TEXT NOT NULL,
  aaguid TEXT,
  nickname TEXT,
  device_type TEXT,
  backed_up INTEGER,
  user_agent TEXT,
  created_at TEXT NOT NULL,
  last_used_at TEXT
) STRICT;

CREATE TABLE webauthn_challenges (
  challenge TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('registration', 'authentication')),
  expires_at INTEGER NOT NULL
) STRICT;
