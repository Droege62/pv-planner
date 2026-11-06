// Build 61 proposal: integrate only inside the EXISTING authenticated Worker router.
// This is a helper module, NOT a deployable replacement Worker.
// Ensure existing authentication checks run BEFORE calling this handler.
// Keep original /forecasts and FOX endpoints unchanged.
export async function handleWeatherModelArchive(request, env) {
  const url = new URL(request.url);
  if (url.pathname !== "/weather-model-forecasts") return null;
  const db = env.DB; // Verify actual D1 binding before integration.
  if (!db) return Response.json({ error: "D1 binding unavailable" }, { status: 503 });
  if (request.method === "GET") {
    const target = url.searchParams.get("date");
    if (target && !/^\d{4}-\d{2}-\d{2}$/.test(target))
      return Response.json({ error: "Invalid date" }, { status: 400 });
    const stmt = target
      ? db.prepare("SELECT target_date,model_id,issued_at,pv_before_16_kwh,pv_daily_kwh,hourly_json,conversion_version FROM weather_model_forecasts WHERE target_date=? ORDER BY issued_at DESC LIMIT 100").bind(target)
      : db.prepare("SELECT target_date,model_id,issued_at,pv_before_16_kwh,pv_daily_kwh,conversion_version FROM weather_model_forecasts ORDER BY target_date DESC,issued_at DESC LIMIT 100");
    const result = await stmt.all();
    return Response.json({ forecasts: result.results });
  }
  if (request.method !== "POST")
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  const b = await request.json().catch(() => null);
  const validDate = s => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s+"T00:00:00Z"));
  const validNumber = x => typeof x === "number" && Number.isFinite(x) && x >= 0 && x <= 100;
  if (!b || !validDate(b.targetDate) ||
      !["ecmwf_ifs025","icon_d2"].includes(b.modelId) ||
      typeof b.issuedAt !== "string" || !Number.isFinite(Date.parse(b.issuedAt)) ||
      Date.parse(b.issuedAt) >= Date.parse(b.targetDate+"T00:00:00Z") ||
      !validNumber(b.pvBefore16Kwh) || !validNumber(b.pvDailyKwh) ||
      b.pvBefore16Kwh > b.pvDailyKwh + 0.01 ||
      !Array.isArray(b.hourly) || b.hourly.length > 48 ||
      !b.hourly.every(x => x && typeof x.time === "string" &&
        Number.isFinite(Date.parse(x.time)) && validNumber(x.pvKwh)) ||
      typeof b.conversionVersion !== "string" || b.conversionVersion.length > 80)
    return Response.json({ error: "Invalid forecast record" }, { status: 400 });
  const hourly = JSON.stringify(b.hourly);
  if (hourly.length > 16000)
    return Response.json({ error: "Record too large" }, { status: 413 });
  const result = await db.prepare(
    "INSERT OR IGNORE INTO weather_model_forecasts (target_date,model_id,issued_at,pv_before_16_kwh,pv_daily_kwh,hourly_json,conversion_version) VALUES (?,?,?,?,?,?,?)"
  ).bind(b.targetDate,b.modelId,b.issuedAt,b.pvBefore16Kwh,b.pvDailyKwh,hourly,b.conversionVersion).run();
  return Response.json({ stored: result.meta.changes === 1, alreadyExists: result.meta.changes === 0 });
}
