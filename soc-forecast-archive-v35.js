// V3 diagnostic: archive first calculated next-day 16:00 SOC forecast.
// Read-only: no changes to the planner, FOX Cloud, or inverter.
const KEY="pvSocForecastArchiveV3";
const peak=document.getElementById("peak");
function ukDate(d){return new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/London",year:"numeric",month:"2-digit",day:"2-digit"}).format(d);}
function tomorrow(){const today=ukDate(new Date());const d=new Date(today+"T12:00:00Z");d.setUTCDate(d.getUTCDate()+1);return d.toISOString().slice(0,10);}
function archive(){
 if(!peak)return;
 const match=peak.textContent.trim().match(/^([0-9]+(?:\.[0-9]+)?)%$/);
 if(!match)return;
 const soc=Number(match[1]);if(!Number.isFinite(soc)||soc<0||soc>100)return;
 const date=tomorrow();
 let saved={};try{saved=JSON.parse(localStorage.getItem(KEY)||"{}")||{};}catch(e){}
 if(saved[date])return;
 saved[date]={socAt16:soc,createdAt:new Date().toISOString(),targetDate:date,source:"V3 displayed predicted battery at 16:00",version:"35"};
 localStorage.setItem(KEY,JSON.stringify(saved));
}
if(peak){new MutationObserver(archive).observe(peak,{childList:true,characterData:true,subtree:true});archive();}
