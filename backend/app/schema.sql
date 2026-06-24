-- Kiroku database schema (SQLite).
-- Single-user, local-first trading journal. All timestamps are ISO 8601 TEXT.
-- Executed by database.py on first run when the tables do not yet exist.

-- Reference data: tradable instruments.
-- massive_ticker is the Massive API symbol used to fetch chart candles (e.g.
-- 'C:EURUSD' for forex, 'ESU5' for futures). NULL means the asset has no chart
-- data.
CREATE TABLE IF NOT EXISTS assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  currency TEXT,
  massive_ticker TEXT,
  is_active BOOLEAN NOT NULL DEFAULT 1,
  created_at TEXT,
  updated_at TEXT
);

-- Reference data: trade setup / pattern tags.
CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT 1,
  created_at TEXT,
  updated_at TEXT
);

-- Reference data: emotional / psychological states.
CREATE TABLE IF NOT EXISTS emotions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  severity TEXT NOT NULL,
  category TEXT NOT NULL,
  created_at TEXT,
  updated_at TEXT
);

-- Core entity: a single trade, aggregating one or more activities.
CREATE TABLE IF NOT EXISTS trades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_id INTEGER REFERENCES assets(id),
  account_type TEXT NOT NULL DEFAULT 'live',
  status TEXT NOT NULL,
  direction TEXT,
  stop_loss REAL,
  notes TEXT,
  missed_opportunity BOOLEAN NOT NULL DEFAULT 0,
  risk_per_trade REAL,
  avg_entry_price REAL,
  avg_exit_price REAL,
  risk REAL,
  reward REAL,
  performance_r REAL,
  timeframe_unit TEXT,
  timeframe_value INTEGER,
  trade_date TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_trades_asset_id ON trades(asset_id);
CREATE INDEX IF NOT EXISTS idx_trades_trade_date ON trades(trade_date);
CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);

-- Individual buy/sell executions that make up a trade.
CREATE TABLE IF NOT EXISTS trade_activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trade_id INTEGER NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  price REAL NOT NULL,
  quantity REAL NOT NULL,
  date TEXT NOT NULL,
  is_entry BOOLEAN NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_trade_activities_trade_id ON trade_activities(trade_id);

-- Junction: trades <-> tags (many-to-many).
CREATE TABLE IF NOT EXISTS trade_tags (
  trade_id INTEGER NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id),
  PRIMARY KEY (trade_id, tag_id)
);

-- Junction: trades <-> emotions (many-to-many).
CREATE TABLE IF NOT EXISTS trade_emotions (
  trade_id INTEGER NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
  emotion_id INTEGER NOT NULL REFERENCES emotions(id),
  PRIMARY KEY (trade_id, emotion_id)
);

-- Chart screenshots attached to a trade, stored in data/screenshots/.
CREATE TABLE IF NOT EXISTS trade_screenshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trade_id INTEGER NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  timeframe_unit TEXT,
  timeframe_value INTEGER,
  label TEXT,
  created_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_trade_screenshots_trade_id ON trade_screenshots(trade_id);

-- Application-level business defaults that feed forms or logic (e.g. the trade
-- form's default risk per trade). Visual preferences (theme, language) stay in
-- the frontend's localStorage. CHECK (id = 1) enforces a single row for this
-- single-user app; future preferences are added as columns. The INSERT OR
-- IGNORE seeds the row so the API always has one to read; it is a no-op once
-- the row exists, so this stays idempotent across startups.
CREATE TABLE IF NOT EXISTS user_preferences (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  risk_per_trade_default REAL NOT NULL DEFAULT 1.0,
  news_enabled BOOLEAN NOT NULL DEFAULT 1,
  news_currencies TEXT NOT NULL DEFAULT '["USD", "EUR", "GBP", "JPY", "CAD", "AUD", "CHF", "NZD"]',
  news_min_impact TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (news_min_impact IN ('HIGH', 'MEDIUM', 'LOW')),
  backup_directory TEXT,
  backup_reminder_days INTEGER NOT NULL DEFAULT 7,
  last_backup_at TEXT,
  massive_api_key TEXT NOT NULL DEFAULT ''
);

INSERT OR IGNORE INTO user_preferences (id, risk_per_trade_default) VALUES (1, 1.0);

-- Macro economic calendar events synced from the free Forex Factory JSON feed.
-- `id` is a deterministic sha256(title + date_utc) truncated to 16 chars, so a
-- re-sync of the same event upserts in place. All dates stored as UTC ISO 8601.
CREATE TABLE IF NOT EXISTS news_events (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  title TEXT NOT NULL,
  currency TEXT NOT NULL,
  impact TEXT NOT NULL CHECK (impact IN ('HIGH', 'MEDIUM', 'LOW', 'NONE')),
  forecast TEXT NOT NULL DEFAULT '',
  previous TEXT NOT NULL DEFAULT '',
  synced_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_news_events_date ON news_events(date);
CREATE INDEX IF NOT EXISTS idx_news_events_currency ON news_events(currency);

-- Historical M1 (1-minute) OHLCV market data backing trade charts, keyed by the
-- Massive API ticker (assets.massive_ticker). Higher timeframes are aggregated
-- on the fly at query time. This is permanent data, not a cache: historical
-- candles never change, so rows are never deleted automatically. `timestamp` is
-- Unix milliseconds, as returned by the Massive API. The composite primary key
-- (ticker, timestamp) deduplicates re-fetched bars in place.
CREATE TABLE IF NOT EXISTS candles (
  ticker TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  open REAL NOT NULL,
  high REAL NOT NULL,
  low REAL NOT NULL,
  close REAL NOT NULL,
  volume REAL NOT NULL,
  PRIMARY KEY (ticker, timestamp)
);
