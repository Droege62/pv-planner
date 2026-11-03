-- PV Planner cloud forecast archive; run against the existing Cloudflare D1 database.
CREATE TABLE IF NOT EXISTS pv_forecasts (
  target_date TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  build TEXT NOT NULL,
  forecast_json TEXT NOT NULL,
  inserted_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_pv_forecasts_created_at ON pv_forecasts(created_at);
