// Add these handlers inside the EXISTING authenticated Cloudflare Worker.
// Use the same authentication middleware as /history; do not expose these paths publicly.
// Replace env.DB with the existing D1 binding name after checking Worker settings.
export async function handleForecastArchive(request, env) {
  const url = new URL(request.url);
  const db = env.DB; // CHECK binding name before deploying
  if (!db) return Response.json({error:"D1 binding not configured"}, {status:503});
  if (request.method==="POST" && url.pathname==="/forecasts") {
    const body=await request.json().catch(()=>null);
    if (!body || !/^\\d{4}-\\d{2}-\\d{2}$/.test(body.targetDate||""))
      return Response.json({error:"Invalid targetDate"}, {status:400});
    const now=new Date().toISOString(),created=new Date(body.createdAt||"");
    if (!Number.isFinite(created.getTime()) || body.targetDate<=now.slice(0,10) || created.toISOString().slice(0,10)>=body.targetDate)
      return Response.json({error:"Only advance forecasts can be archived"}, {status:400});
    const allowed=["targetDate","createdAt","build","forecastPvKwh","hourlyPvKwh","predictedDailyHouseKwh","predictedHouse05to16Kwh","hourlyHouseKwh","consumptionSource","afternoonTargetSoc","recommendedOvernightSoc","predictedSocAt16","predictedSocAt16WithoutCharge","estimatedBatteryGridChargeKwh","startingSocPercent","calibrationFactor","note"];
    const clean=Object.fromEntries(allowed.filter(k=>Object.hasOwn(body,k)).map(k=>[k,body[k]]));
    const serialized=JSON.stringify(clean);
    if (serialized.length>12000) return Response.json({error:"Forecast too large"}, {status:413});
    const res=await db.prepare("INSERT OR IGNORE INTO pv_forecasts (target_date,created_at,build,forecast_json) VALUES (?,?,?,?)").bind(body.targetDate,body.createdAt,String(body.build||"unknown"),serialized).run();
    return Response.json({stored:res.meta.changes===1,alreadyExists:res.meta.changes===0,targetDate:body.targetDate});
  }
  if (request.method==="GET" && url.pathname==="/forecasts") {
    const rows=await db.prepare("SELECT target_date,created_at,forecast_json FROM pv_forecasts ORDER BY target_date DESC LIMIT 90").all();
    return Response.json({forecasts:rows.results.map(x=>JSON.parse(x.forecast_json))});
  }
  return Response.json({error:"Not found"}, {status:404});
}
