// Read-only intraday SOC estimate; never alters overnight charging plan.
(async()=>{
 const host=document.createElement("section");host.className="card";
 host.innerHTML='<b>Today at 16:00 — live reassessment</b><div id="liveSocEstimate" class="sub">Waiting for FOX data…</div><div class="small">Diagnostic only. Uses current SOC, hourly weather forecast and historical household load; no inverter control.</div>';
 const peak=document.getElementById("peak");if(!peak)return;
 peak.closest(".card").parentElement.after(host);
 const output=document.getElementById("liveSocEstimate");
 const UK="Europe/London",C={lat:52.27,lon:-1.89,tilt:22,faces:[[110,8],[290,5]],panel:505,batt:11.52};
 const fmt=new Intl.DateTimeFormat("en-CA",{timeZone:UK,year:"numeric",month:"2-digit",day:"2-digit"});
 const hourFmt=new Intl.DateTimeFormat("en-GB",{timeZone:UK,hour:"2-digit",hourCycle:"h23"});
 const date=d=>fmt.format(d),hour=d=>Number(hourFmt.format(d));
 function sun(d){const rad=Math.PI/180;const start=new Date(Date.UTC(d.getUTCFullYear(),0,0));const day=Math.floor((d-start)/86400000);const decl=23.44*Math.sin(2*Math.PI*(284+day)/365)*rad;const h=(d.getUTCHours()+d.getUTCMinutes()/60+ C.lon/15-12)*15*rad;const lat=C.lat*rad;const alt=Math.asin(Math.sin(lat)*Math.sin(decl)+Math.cos(lat)*Math.cos(decl)*Math.cos(h));const az=Math.atan2(Math.sin(h),Math.cos(h)*Math.sin(lat)-Math.tan(decl)*Math.cos(lat))+Math.PI;return {alt,az};}
 function estimate(ghi,d){const {alt,az}=sun(d);if(alt<=0)return 0;const tilt=C.tilt*Math.PI/180;return C.faces.reduce((sum,[bearing,n])=>{const incidence=Math.sin(alt)*Math.cos(tilt)+Math.cos(alt)*Math.sin(tilt)*Math.cos(az-bearing*Math.PI/180);const factor=.72*Math.max(0,incidence/Math.max(.12,Math.sin(alt)))+.28*(1+Math.cos(tilt))/2;return sum+ghi*factor*n*C.panel/1e6;},0)*.82;}
 async function refresh(){
  const token=localStorage.getItem("pvFoxAccessToken");if(!token){output.textContent="Connect FOX Cloud to show live estimate.";return;}
  const now=new Date(),today=date(now);if(hour(now)>=16){output.textContent="After 16:00; today's target has passed.";return;}
  try{
   const base="https://fox-pv-connector.peter-droegemueller.workers.dev";
   const [live,weather,profile]=await Promise.all([
    fetch(base+"/summary",{headers:{Authorization:"Bearer "+token},cache:"no-store"}).then(r=>{if(!r.ok)throw Error("FOX HTTP "+r.status);return r.json()}),
    fetch("https://api.open-meteo.com/v1/forecast?latitude="+C.lat+"&longitude="+C.lon+"&hourly=shortwave_radiation&forecast_days=2&timezone=UTC").then(r=>r.json()),
    fetch(base+"/consumption-profile",{headers:{Authorization:"Bearer "+token}}).then(r=>r.json()).catch(()=>null)
   ]);
   const raw=live.batterySOC??live.soc??live.battery_soc??live.batterySoc;
   const soc=Number(raw);if(!Number.isFinite(soc))throw Error("Live SOC missing");
   const loads=Array(24).fill(.25);if(Array.isArray(profile?.hours))for(const x of profile.hours){const h=Number(x.utc_hour),p=Number(x.avg_power_kw);if(h>=0&&h<24&&Number.isFinite(p))loads[h]=p;}
   let energy=soc/100*C.batt,pvRemaining=0,loadRemaining=0;
   for(let i=0;i<(weather.hourly?.time||[]).length;i++){const t=new Date(weather.hourly.time[i]+":00Z");if(date(t)!==today||hour(t)>=16)continue;const duration=Math.max(0,(t.getTime()+3600000-Math.max(now.getTime(),t.getTime()))/3600000);if(!duration)continue;const pv=estimate(Number(weather.hourly.shortwave_radiation[i]||0),t)*duration;const load=loads[t.getUTCHours()]*duration;pvRemaining+=pv;loadRemaining+=load;energy=Math.min(C.batt,Math.max(.1*C.batt,energy+(pv-load)*.94));}
   const predicted=Math.round(100*energy/C.batt);
   output.textContent="FOX SOC now "+soc.toFixed(0)+"% → estimated 16:00 SOC "+predicted+"% | remaining PV ~"+pvRemaining.toFixed(1)+" kWh; household use ~"+loadRemaining.toFixed(1)+" kWh.";
  }catch(e){output.textContent="Live reassessment unavailable: "+e.message;}
 }
 refresh();document.addEventListener("visibilitychange",()=>{if(!document.hidden)refresh()});
 setInterval(()=>{if(!document.hidden)refresh()},15*60*1000);
})();
