// Build 51: learn PV correction from advance cloud forecasts and FOX daily energy.
// No inverter writes. Requires five valid matched days before activation.
(async function(){
 const card=document.createElement("section");card.className="card";
 card.innerHTML='<h3>Build 51 — cloud PV learning</h3><div id="cloudLearn51">Checking archived forecasts and FOX actuals…</div>';
 document.body.append(card);
 const out=document.getElementById("cloudLearn51");
 const token=localStorage.getItem("pvFoxAccessToken");
 if(!token){out.textContent="Connect FOX Cloud to enable historical learning.";return}
 const base="https://fox-pv-connector.peter-droegemueller.workers.dev";
 async function read(path){const r=await fetch(base+path,{headers:{Authorization:"Bearer "+token},cache:"no-store"});if(!r.ok)throw Error("HTTP "+r.status);return r.json()}
 const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/London",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
 try{
  const archive=await read("/forecasts");
  const forecasts=(archive.forecasts||[]).filter(f=>f&&f.targetDate<today&&Number.isFinite(Date.parse(f.createdAt))&&Date.parse(f.createdAt)<Date.parse(f.targetDate+"T00:00:00Z")&&Number(f.forecastPvKwh)>0);
  const monthly={};const pairs=[];
  for(const f of forecasts){
   const [year,month,day]=f.targetDate.split("-").map(Number);
   const key=year+"-"+month;
   if(!monthly[key])monthly[key]=read("/energy?year="+year+"&month="+month+"&dimension=month");
   try{
    const data=await monthly[key],report=data.report||data.data||data.result||[];
    const series=report.find(x=>x.variable==="PVEnergyTotal");
    const raw=series&&series.values?series.values[day-1]:null;
    if(raw==null||raw==="")continue;
    const actual=Number(raw),forecast=Number(f.forecastPvKwh),previousCorrection=Number(f.calibrationFactor)||1;
    if(!Number.isFinite(actual)||actual<0||!Number.isFinite(previousCorrection))continue;
    pairs.push({date:f.targetDate,actual,forecast,ratio:actual/forecast*previousCorrection});
   }catch(e){}
  }
  pairs.sort((a,b)=>a.date.localeCompare(b.date));
  const recent=pairs.slice(-14),ratios=recent.map(x=>x.ratio).filter(x=>Number.isFinite(x)&&x>=0&&x<=3).sort((a,b)=>a-b);
  const active=ratios.length>=5;
  const factor=active?Math.max(.85,Math.min(1.15,ratios[Math.floor(ratios.length/2)])):null;
  if(active){
   const original=window.learned;
   window.learned=function(){return factor};
   if(typeof window.run==="function")window.run();
  }
  const table=document.createElement("table");table.innerHTML="<tr><th>Date</th><th>Forecast PV</th><th>FOX actual</th><th>Error</th></tr>";
  for(const p of recent.slice(-7).reverse()){
   const tr=document.createElement("tr");
   for(const value of [p.date,p.forecast.toFixed(1)+" kWh",p.actual.toFixed(1)+" kWh",(p.actual-p.forecast).toFixed(1)+" kWh"]){const td=document.createElement("td");td.textContent=value;tr.append(td)}
   table.append(tr);
  }
  const summary=document.createElement("p");summary.className="small";
  summary.textContent=active?"Cloud learning active: "+ratios.length+" matched days, PV correction ×"+factor.toFixed(2)+". Updated V3 forecast.":"Cloud learning waiting: "+ratios.length+"/5 valid advance forecast days. Existing model remains unchanged.";
  const note=document.createElement("p");note.className="small";note.textContent="Uses full-day FOX PVEnergyTotal and the first saved forecast per date. Correction is capped at 0.85–1.15. Does not change FOX settings or retrospectively modify forecasts.";
  out.replaceChildren(summary,table,note);
 }catch(e){out.textContent="Cloud learning unavailable: "+e.message}
})();
