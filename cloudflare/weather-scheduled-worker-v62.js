// Build 62 — dedicated scheduled Cloudflare Worker.
// Deploy as a NEW Worker, not as a replacement for fox-pv-connector.
// Bind existing D1 database pv-planner-history as DB.
// Cron: 0 18 * * * (18:00 UTC; 19:00 BST in summer).
const C = {lat:52.27,lon:-1.895,tilt:22,az1:110,az2:290,n1:8,n2:5,panelW:505,maxInv:6,baseLoss:.94};
const MODELS = ["ecmwf_ifs025","icon_d2"];
function ukDate(d) {
  return new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/London",year:"numeric",month:"2-digit",day:"2-digit"}).format(d);
}
function ukHour(d) {
  return Number(new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/London",hour:"2-digit",hourCycle:"h23"}).format(d));
}
function sun(t) {
  const d=(t-new Date(Date.UTC(t.getUTCFullYear(),0,0)))/864e5;
  const g=2*Math.PI/365*(d-1+(t.getUTCHours()-12)/24);
  const dc=.006918-.399912*Math.cos(g)+.070257*Math.sin(g)-.006758*Math.cos(2*g)+.000907*Math.sin(2*g)-.002697*Math.cos(3*g)+.00148*Math.sin(3*g);
  const eq=229.18*(.000075+.001868*Math.cos(g)-.032077*Math.sin(g)-.014615*Math.cos(2*g)-.040849*Math.sin(2*g));
  const ha=(t.getUTCHours()*60+t.getUTCMinutes()+eq+4*C.lon)/4-180;
  const la=C.lat*Math.PI/180,h=ha*Math.PI/180;
  const cz=Math.sin(la)*Math.sin(dc)+Math.cos(la)*Math.cos(dc)*Math.cos(h);
  return {el:Math.asin(Math.max(-1,Math.min(1,cz))),az:Math.atan2(Math.sin(h),Math.cos(h)*Math.sin(la)-Math.tan(dc)*Math.cos(la))+Math.PI};
}
async function modelForecast(model,target,issuedAt) {
  const q=new URLSearchParams({
    latitude:String(C.lat),longitude:String(C.lon),models:model,
    hourly:"shortwave_radiation,direct_normal_irradiance,diffuse_radiation,temperature_2m",
    forecast_days:"3",timezone:"UTC"
  });
  const res=await fetch("https://api.open-meteo.com/v1/forecast?"+q);
  if(!res.ok) throw Error(model+" weather HTTP "+res.status);
  const data=(await res.json()).hourly;
  if(!data || !Array.isArray(data.time) || !Array.isArray(data.shortwave_radiation) ||
    !Array.isArray(data.direct_normal_irradiance) || !Array.isArray(data.diffuse_radiation) ||
    !Array.isArray(data.temperature_2m)) throw Error(model+" missing hourly data");
  const tilt=C.tilt*Math.PI/180,sky=(1+Math.cos(tilt))/2,ground=(1-Math.cos(tilt))/2;
  let full=0,before16=0;
  const hourly=[];
  for(let i=0;i<data.time.length;i++){
    const t=new Date(data.time[i]+":00Z");
    if(ukDate(t)!==target) continue;
    const s=sun(t);
    let energy=0;
    if(s.el>0){
      const ghi=Math.max(0,Number(data.shortwave_radiation[i])||0);
      const dni=Math.max(0,Number(data.direct_normal_irradiance[i])||0);
      const dhi=Math.max(0,Number(data.diffuse_radiation[i])||0);
      const ambient=Number(data.temperature_2m[i]);
      if(!Number.isFinite(ambient)) throw Error(model+" missing temperature");
      const face=(azimuth,panels)=>{
        const az=azimuth*Math.PI/180;
        const incidence=Math.sin(s.el)*Math.cos(tilt)+Math.cos(s.el)*Math.sin(tilt)*Math.cos(s.az-az);
        return panels*C.panelW/1e6*(dni*Math.max(0,incidence)+dhi*sky+ghi*.2*ground);
      };
      const raw=face(C.az1,C.n1)+face(C.az2,C.n2);
      const temp=Math.max(.75,1-.0029*Math.max(0,ambient+.03*ghi-25));
      energy=Math.max(0,Math.min(C.maxInv,raw*temp*C.baseLoss));
    }
    full+=energy;
    if(ukHour(t)<16) before16+=energy;
    hourly.push({time:t.toISOString(),pvKwh:Number(energy.toFixed(5))});
  }
  if(hourly.length<23||hourly.length>25) throw Error(model+" incomplete target date");
  return {target,model,issuedAt,before16,full,hourly};
}
async function archive(env) {
  if(!env.DB) throw Error("Missing DB binding");
  const now=new Date(),issuedAt=now.toISOString();
  // At 18:00 UTC, the following UTC calendar day is also tomorrow in London.
  const next=new Date(now);
  next.setUTCDate(next.getUTCDate()+1);
  const target=ukDate(next);
  const results=[];
  for(const model of MODELS){
    try{
      const f=await modelForecast(model,target,issuedAt);
      const inserted=await env.DB.prepare(
        "INSERT OR IGNORE INTO weather_model_forecasts (target_date,model_id,issued_at,pv_before_16_kwh,pv_daily_kwh,hourly_json,conversion_version) VALUES (?,?,?,?,?,?,?)"
      ).bind(f.target,f.model,f.issuedAt,Number(f.before16.toFixed(5)),Number(f.full.toFixed(5)),JSON.stringify(f.hourly),"v60-roof-model-1").run();
      results.push({model,stored:inserted.meta.changes===1});
    }catch(e){results.push({model,error:String(e)});}
  }
  if(results.some(x=>x.error)) throw Error(JSON.stringify(results));
  return {target,issuedAt,results};
}
export default {
  async scheduled(event,env,ctx) {
    ctx.waitUntil(archive(env).then(r=>console.log("Weather forecast archive:",JSON.stringify(r))));
  },
  async fetch() {
    return new Response("Scheduled weather forecast archive. No public API.",{status:200,headers:{"content-type":"text/plain"}});
  }
};
