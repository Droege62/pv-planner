// Build 53: read-only verification of 15-minute household power.
window.__pvLoadLearning53={status:"loading",profile:null,days:0,samples:0};
(async()=>{
const box=document.createElement("section");box.className="card";box.innerHTML='<h3>Build 53 — measured load learning</h3><div id="load53">Loading historical data…</div>';document.body.append(box);
const out=document.getElementById("load53"),token=localStorage.getItem("pvFoxAccessToken");
if(!token){out.textContent="Connect FOX Cloud first.";window.__pvLoadLearning53.status="unavailable";return}
const root="https://fox-pv-connector.peter-droegemueller.workers.dev";
const buckets=Array.from({length:24},()=>[]);let days=0,samples=0;
for(let i=1;i<=14;i++){
const d=new Date();d.setUTCDate(d.getUTCDate()-i);
if(d.getUTCDay()===0)continue;
try{
const r=await fetch(root+"/history?date="+d.toISOString().slice(0,10),{headers:{Authorization:"Bearer "+token},cache:"no-store"});
if(!r.ok)continue;
const data=await r.json(),records=data.measurements||[];let n=0;
for(const x of records){
const power=Number(x.house_power_kw);
if(x.house_power_kw==null||!Number.isFinite(power)||power<0||power>20)continue;
const h=new Date(x.recorded_at).getUTCHours();if(!Number.isInteger(h))continue;
buckets[h].push(power);n++;samples++;
}
if(n>=70)days++;
}catch(e){}
}
const med=a=>{const s=a.slice().sort((a,b)=>a-b);return s.length?s[Math.floor(s.length/2)]:null};
const profile=buckets.map(med),ready=days>=5&&profile.every(x=>x!==null);
if(ready){foxConsumptionProfile=profile.map((avg_power_kw,utc_hour)=>({utc_hour,avg_power_kw}));if(typeof run==="function")run()}
window.__pvLoadLearning53={status:ready?"ready":"insufficient",profile:ready?foxConsumptionProfile.map(x=>({...x})):null,days,samples};
const p=document.createElement("p");p.textContent="Non-Sunday days with at least 70 house-power readings: "+days+"; valid samples: "+samples+".";
const q=document.createElement("p");q.textContent=ready?"Historical median household profile now used in V3 predictions.":"Existing FOX hourly consumption profile retained; insufficient validated 15-minute house-power data.";
out.replaceChildren(p,q);
})();
