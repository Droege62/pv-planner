// Read-only audit of historical SOC at 16:00 UTC.
export async function auditSoc(getHistory, dates) {
  const results = [];
  for (const date of dates) {
    const data = await getHistory(date);
    const rows = Array.isArray(data.measurements) ? data.measurements : [];
    const stamps = rows.map(r => Date.parse(r.recorded_at)).filter(Number.isFinite).sort((a,b)=>a-b);
    const gaps = stamps.slice(1).map((t,i)=>(t-stamps[i])/60000);
    const target = Date.parse(date+"T16:00:00Z");
    const eligible = rows.filter(r=>r.battery_soc!==null && r.battery_soc!==undefined && Number.isFinite(Number(r.battery_soc)) && Number.isFinite(Date.parse(r.recorded_at)));
    eligible.sort((a,b)=>Math.abs(Date.parse(a.recorded_at)-target)-Math.abs(Date.parse(b.recorded_at)-target));
    const nearest=eligible[0];
    const offset=nearest?Math.abs(Date.parse(nearest.recorded_at)-target)/60000:null;
    results.push({date,count:rows.length,nearestAt:nearest?.recorded_at??null,soc:offset!==null&&offset<=15?Number(nearest.battery_soc):null,offsetMinutes:offset,maxGapMinutes:gaps.length?Math.max(...gaps):null});
  }
  return results;
}
