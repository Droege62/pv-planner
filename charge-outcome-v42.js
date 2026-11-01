// Build 42 — historical charging outcome, read-only FOX D1 measurements.
// Uses UK local date; only completed days are compared.
(async()=>{
 const anchor=document.getElementById("peak");if(!anchor)return;
 const card=document.createElement("section");card.className="card";
 card.innerHTML='<b>Overnight charge outcome — Build 42</b><div id="chargeOutcome42" class="sub">Retrieving historical measurements…</div><div class="small">05:00 and 16:00 SOC from FOX history. Chosen target is manually entered, not independently verified against FOX settings. No inverter control.</div>';
 anchor.closest(".card").parentElement.after(card);
 const out=document.getElementById("chargeOutcome42"),token=localStorage.getItem("pvFoxAccessToken");
 if(!token){out.textContent="FOX not connected.";return;}
 const dateFmt=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/London",year:"numeric",month:"2-digit",day:"2-digit"});
 const today=dateFmt.format(new Date()),d=new Date(today+"T12:00:00Z");d.setUTCDate(d.getUTCDate()-1);const date=d.toISOString().slice(0,10);
 const targets=(()=>{try{return JSON.parse(localStorage.getItem("pvChosenOvernightTargetV41")||"{}")}catch(e){return {}}})();
 const target=targets[date]?.targetSoc;
 try{
  const r=await fetch("https://fox-pv-connector.peter-droegemueller.workers.dev/history?date="+date,{headers:{Authorization:"Bearer "+token},cache:"no-store"});
  if(!r.ok)throw Error("FOX HTTP "+r.status);
  const j=await r.json(),rows=Array.isArray(j.measurements)?j.measurements:[];
  function near(h){const at=Date.parse(date+"T"+String(h).padStart(2,"0")+":00:00Z");const a=rows.filter(x=>x.battery_soc!=null&&Number.isFinite(Number(x.battery_soc))&&Number.isFinite(Date.parse(x.recorded_at))).sort((x,y)=>Math.abs(Date.parse(x.recorded_at)-at)-Math.abs(Date.parse(y.recorded_at)-at));const first=a[0];return first&&Math.abs(Date.parse(first.recorded_at)-at)<=15*60000?Number(first.battery_soc):null;}
  const soc05=near(5),soc16=near(16);
  const textTarget=Number.isFinite(target)?target+"%":"Not recorded";
  const difference=Number.isFinite(target)&&soc05!==null?" (actual minus target: "+(soc05-target>=0?"+":"")+(soc05-target)+" points)":"";
  out.textContent=date+" | chosen target: "+textTarget+" | measured SOC at 05:00: "+(soc05===null?"unavailable":soc05+"%"+difference)+" | measured SOC at 16:00: "+(soc16===null?"unavailable":soc16+"%")+".";
 }catch(e){out.textContent="Outcome unavailable: "+e.message;}
})();
