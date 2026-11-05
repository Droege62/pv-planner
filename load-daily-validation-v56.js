// Build 56: read-only daily load back-test against 15-minute FOX power samples.
// All dates and hour buckets are UTC. No inverter writes or planner changes.
(async () => {
  const panel=document.createElement("section");panel.className="card";
  panel.innerHTML='<h3>Build 56 — daily household load validation</h3><div id="load56">Loading FOX history…</div>';
  document.body.append(panel);
  const out=document.getElementById("load56"),token=localStorage.getItem("pvFoxAccessToken");
  if(!token){out.textContent="Connect FOX Cloud first.";return}
  const root="https://fox-pv-connector.peter-droegemueller.workers.dev";
  try{
    const r=await fetch(root+"/consumption-profile",{headers:{Authorization:"Bearer "+token},cache:"no-store"});
    if(!r.ok)throw Error("FOX profile HTTP "+r.status);
    const old=(await r.json()).hours;
    const wait=async()=>{for(let i=0;i<120;i++){const x=window.__pvLoadLearning53;if(x&&x.status!=="loading")return x;await new Promise(resolve=>setTimeout(resolve,500))}throw Error("Learning timed out")};
    const learned=await wait();
    if(learned.status!=="ready"||!Array.isArray(learned.profile))throw Error("Learned profile unavailable: "+learned.status);
    const total=p=>p.reduce((sum,x)=>sum+Number(x.avg_power_kw||0),0);
    const oldDaily=total(old),newDaily=total(learned.profile);
    if(!Number.isFinite(oldDaily)||!Number.isFinite(newDaily))throw Error("Invalid profile");
    const dates=[];for(let i=1;i<=14;i++){const d=new Date();d.setUTCHours(12,0,0,0);d.setUTCDate(d.getUTCDate()-i);if(d.getUTCDay()!==0)dates.push(d.toISOString().slice(0,10))}
    const table=document.createElement("table");
    table.innerHTML="<tr><th>UTC date</th><th>Samples</th><th>Measured*</th><th>Old FOX</th><th>Median</th></tr>";
    const eligible=[];let excluded=0;
    for(const date of dates){
      try{
        const h=await fetch(root+"/history?date="+date,{headers:{Authorization:"Bearer "+token},cache:"no-store"});
        if(!h.ok){excluded++;continue}
        const data=await h.json(),a=data.measurements||[];
        const slots=new Map();
        for(const x of a){
          const p=Number(x.house_power_kw),t=Date.parse(x.recorded_at);
          if(x.house_power_kw==null||!Number.isFinite(p)||p<0||p>20||!Number.isFinite(t))continue;
          if(new Date(t).toISOString().slice(0,10)!==date)continue;
          const mins=new Date(t).getUTCHours()*60+new Date(t).getUTCMinutes();
          const slot=Math.floor(mins/15);
          if(slot>=0&&slot<96){if(!slots.has(slot))slots.set(slot,[]);slots.get(slot).push(p)}
        }
        // Reject sparse days. 15-minute samples are treated as interval means.
        if(slots.size<90){excluded++;continue}
        const measured=Array.from(slots.values()).reduce((s,values)=>s+values.reduce((a,b)=>a+b,0)/values.length*0.25,0);
        eligible.push({date,n:slots.size,measured});
        const row=document.createElement("tr");
        for(const value of [date,String(slots.size),measured.toFixed(2)+" kWh",oldDaily.toFixed(2)+" kWh",newDaily.toFixed(2)+" kWh"]){
          const cell=document.createElement("td");cell.textContent=value;row.append(cell)
        }
        table.append(row)
      }catch(e){excluded++}
    }
    if(!eligible.length){out.textContent="No days with at least 90 of 96 valid quarter-hour intervals; cannot compare reliably.";return}
    const mae=p=>eligible.reduce((s,d)=>s+Math.abs(d.measured-p),0)/eligible.length;
    const bias=p=>eligible.reduce((s,d)=>s+(d.measured-p),0)/eligible.length;
    const avg=eligible.reduce((s,d)=>s+d.measured,0)/eligible.length;
    const summary=document.createElement("p");
    summary.textContent="Valid non-Sunday days: "+eligible.length+"; excluded or unavailable: "+excluded+". Average measured*: "+avg.toFixed(2)+" kWh/day. Mean absolute error: old FOX "+mae(oldDaily).toFixed(2)+" kWh/day; learned median "+mae(newDaily).toFixed(2)+" kWh/day. Mean signed error (measured minus prediction): old "+bias(oldDaily).toFixed(2)+", learned "+bias(newDaily).toFixed(2)+" kWh/day.";
    const note=document.createElement("p");note.className="small";
    note.textContent="*Measured is an approximation from sampled FOX house_power_kw (0.25 h per 15-minute interval), not the FOX daily energy counter. Days with fewer than 90/96 intervals are excluded; small gaps remain unfilled. Profiles are compared on overlapping training dates (in-sample), not an independent future validation. Sunday excluded; exceptional appliance loads remain. No SOC or charging target changes.";
    out.replaceChildren(summary,table,note)
  }catch(e){out.textContent="Daily validation unavailable: "+e.message}
})();
