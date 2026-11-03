// Read-only comparison of FOX history with the user's reported 3 Nov charge target.
(async()=>{
 const card=document.createElement("section");card.className="card";
 card.innerHTML='<h3>3 November — FOX SOC validation (Build 46)</h3><p class="small">User-reported overnight target: 65%. FOX measurements are historical; no inverter commands are sent.</p><div id="foxNov3Status46">Loading historical SOC…</div>';
 document.body.append(card);
 const out=document.getElementById("foxNov3Status46");
 const token=localStorage.getItem("pvFoxAccessToken");
 if(!token){out.textContent="FOX not connected in this browser. Connect FOX in the planner and reload.";return;}
 try{
  const response=await fetch("https://fox-pv-connector.peter-droegemueller.workers.dev/history?date=2026-11-03",{headers:{Authorization:"Bearer "+token},cache:"no-store"});
  if(!response.ok)throw Error("FOX HTTP "+response.status);
  const data=await response.json(),rows=Array.isArray(data.measurements)?data.measurements:[];
  const points=rows.filter(r=>r.battery_soc!=null&&Number.isFinite(Number(r.battery_soc))&&Number.isFinite(Date.parse(r.recorded_at))).map(r=>({t:Date.parse(r.recorded_at),soc:Number(r.battery_soc)})).sort((a,b)=>a.t-b.t);
  const nearest=h=>{const time=Date.parse("2026-11-03T"+String(h).padStart(2,"0")+":00:00Z");const p=points.reduce((best,p)=>!best||Math.abs(p.t-time)<Math.abs(best.t-time)?p:best,null);return p&&Math.abs(p.t-time)<=15*60000?p:null;};
  const time=p=>p?new Date(p.t).toLocaleTimeString("en-GB",{timeZone:"Europe/London",hour:"2-digit",minute:"2-digit"}):"—";
  const soc=p=>p?p.soc.toFixed(0)+"% at "+time(p):"unavailable";
  const p05=nearest(5),p13=nearest(13),p14=nearest(14),p16=nearest(16);
  const daytime=points.filter(p=>p.t>=Date.parse("2026-11-03T05:00:00Z")&&p.t<=Date.parse("2026-11-03T16:00:00Z"));
  const peak=daytime.reduce((best,p)=>!best||p.soc>best.soc?p:best,null);
  out.replaceChildren();
  const lines=["05:00: "+soc(p05),"13:00: "+soc(p13),"14:00: "+soc(p14),"16:00: "+soc(p16),"Maximum observed 05:00–16:00: "+soc(peak)];
  for(const line of lines){const p=document.createElement("p");p.textContent=line;out.append(p);}
  const note=document.createElement("p");note.className="small";note.textContent="Forecast reference: 9.3 kWh PV before 16:00 and 97.5% SOC at 16:00, under the earlier Build 45 model. FOX screenshot at 16:38 shows 91% after forced discharge began; it is not the 16:00 SOC. Daily PV was 7.7 kWh by 16:38, not an exact 16:00 reading. Values within 15 minutes of checkpoints are accepted.";
  out.append(note);
 }catch(error){out.textContent="Unable to retrieve FOX history: "+error.message;}
})();