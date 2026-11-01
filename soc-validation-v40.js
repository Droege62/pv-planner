// Build 40 — read-only validation of the last completed day's 16:00 SOC.
(async()=>{
 const anchor=document.getElementById("peak");if(!anchor)return;
 const card=document.createElement("section");card.className="card";
 card.innerHTML='<b>Yesterday: forecast validation — Build 40</b><div id="socValidation40" class="sub">Checking FOX historical SOC…</div><div class="small">A forecast comparison is shown only when a forecast was archived before the target day. No inverter settings are changed.</div>';
 anchor.closest(".card").parentElement.after(card);
 const output=document.getElementById("socValidation40");
 const ukDate=d=>new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/London",year:"numeric",month:"2-digit",day:"2-digit"}).format(d);
 const today=ukDate(new Date());const day=new Date(today+"T12:00:00Z");day.setUTCDate(day.getUTCDate()-1);const date=day.toISOString().slice(0,10);
 const token=localStorage.getItem("pvFoxAccessToken");if(!token){output.textContent="FOX not connected. Connect in V3 to validate.";return;}
 try{
  const response=await fetch("https://fox-pv-connector.peter-droegemueller.workers.dev/history?date="+date,{headers:{Authorization:"Bearer "+token},cache:"no-store"});
  if(!response.ok)throw Error("FOX history HTTP "+response.status);
  const history=await response.json();
  const target=Date.parse(date+"T16:00:00Z");
  const rows=(history.measurements||[]).filter(x=>x.battery_soc!==null&&Number.isFinite(Number(x.battery_soc))&&Number.isFinite(Date.parse(x.recorded_at))).sort((a,b)=>Math.abs(Date.parse(a.recorded_at)-target)-Math.abs(Date.parse(b.recorded_at)-target));
  const nearest=rows[0];if(!nearest||Math.abs(Date.parse(nearest.recorded_at)-target)>15*60000){output.textContent=date+": no measured SOC within 15 minutes of 16:00 UK.";return;}
  const actual=Number(nearest.battery_soc);
  let archive={};try{archive=JSON.parse(localStorage.getItem("pvSocForecastArchiveV3")||"{}")}catch(e){}
  const forecast=archive[date];
  if(!forecast||!Number.isFinite(Number(forecast.socAt16))){output.textContent=date+": actual 16:00 SOC "+actual+"%. No advance SOC prediction archived on this browser; cannot calculate an honest forecast error.";return;}
  const predicted=Number(forecast.socAt16);
  const issued=Date.parse(forecast.createdAt||"");
  if(!Number.isFinite(issued)||issued>=Date.parse(date+"T00:00:00Z")){output.textContent=date+": actual "+actual+"%; stored prediction was not verified as issued before the target day.";return;}
  output.textContent=date+": predicted "+predicted+"%; actual "+actual+"%; error "+(actual-predicted>=0?"+":"")+(actual-predicted)+" percentage points (actual minus predicted).";
 }catch(e){output.textContent="Validation unavailable: "+e.message;}
})();
