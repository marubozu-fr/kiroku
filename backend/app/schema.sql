-- Kiroku database schema (SQLite).
-- Single-user, local-first trading journal. All timestamps are ISO 8601 TEXT.
-- Executed by database.py on first run when the tables do not yet exist.

-- Reference data: tradable instruments.
CREATE TABLE IF NOT EXISTS assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  currency TEXT,
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
  created_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_trade_screenshots_trade_id ON trade_screenshots(trade_id);
