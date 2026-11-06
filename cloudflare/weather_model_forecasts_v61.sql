-- Build 61: separate, immutable multi-model weather forecast archive.
-- Apply to the EXISTING D1 database, after confirming the binding name.
-- Does not modify pv_forecasts or FOX history tables.
CREATE TABLE IF NOT EXISTS weather_model_forecasts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_date TEXT NOT NULL,
  model_id TEXT NOT NULL CHECK (model_id IN ('ecmwf_ifs025','icon_d2')),
  issued_at TEXT NOT NULL,
  saved_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  pv_before_16_kwh REAL NOT NULL CHECK (pv_before_16_kwh >= 0),
  pv_daily_kwh REAL NOT NULL CHECK (pv_daily_kwh >= 0),
  hourly_json TEXT NOT NULL,
  conversion_version TEXT NOT NULL,
  UNIQUE(target_date,model_id,issued_at)
);
CREATE INDEX IF NOT EXISTS idx_weather_forecasts_target
  ON weather_model_forecasts(target_date,model_id,issued_at);
