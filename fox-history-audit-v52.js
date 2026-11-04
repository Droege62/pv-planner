// Build 52: read-only audit of historical FOX data.
(async()=>{
const card=document.createElement("section");card.className="card";card.innerHTML='<h3>Build 52 — FOX historical data</h3><div id="audit52">Loading…</div>';document.body.append(card);
const out=document.getElementById("audit52"),token=localStorage.getItem("pvFoxAccessToken");
if(!token){out.textContent="Connect FOX Cloud first.";return}
const root="https://fox-pv-connector.peter-droegemueller.workers.dev";
async function get(path){const r=await fetch(root+path,{headers:{Authorization:"Bearer "+token},cache:"no-store"});if(!r.ok)throw Error("HTTP "+r.status);return r.json()}
try{
const profile=await get("/consumption-profile");
const hours=profile.hours||[];
const values=Array(24).fill(null);
for(const x of hours){const h=Number(x.utc_hour),p=Number(x.avg_power_kw);if(Number.isInteger(h)&&h>=0&&h<24&&Number.isFinite(p)&&p>=0)values[h]=p}
const count=values.filter(x=>x!==null).length;
const total=(start,end)=>values.slice(start,end).reduce((a,b)=>a+b,0);
const p=document.createElement("p");p.textContent=count===24?"FOX learned household demand (UTC profile): 00–05 "+total(0,5).toFixed(2)+" kWh, 05–16 "+total(5,16).toFixed(2)+" kWh, 14–16 "+total(14,16).toFixed(2)+" kWh, full day "+total(0,24).toFixed(2)+" kWh.":"FOX profile has "+count+"/24 valid hours.";
const table=document.createElement("table");table.innerHTML="<tr><th>Date</th><th>History rows</th><th>SOC rows</th></tr>";
let rows=0;
for(let i=1;i<=7;i++){
const d=new Date();d.setUTCDate(d.getUTCDate()-i);const day=d.toISOString().slice(0,10);
let n="unavailable",soc="—";
try{const h=await get("/history?date="+day),a=h.measurements||[];n=String(a.length);soc=String(a.filter(x=>x.battery_soc!=null).length);rows+=a.length}catch(e){}
const tr=document.createElement("tr");for(const x of [day,n,soc]){const td=document.createElement("td");td.textContent=x;tr.append(td)}table.append(tr)
}
const note=document.createElement("p");note.className="small";note.textContent="Total history rows across seven completed UTC dates: "+rows+". Existing planner already uses the hourly FOX profile. This audit does not alter forecasts or charging advice. Next: validate the 15-minute load fields and exclude abnormal free-electricity periods before retraining.";
out.replaceChildren(p,table,note);
}catch(e){out.textContent="History audit unavailable: "+e.message}
})();
