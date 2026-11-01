import {auditSoc} from "./soc-audit-v35.js";
document.getElementById("run").onclick=async()=>{
 const status=document.getElementById("status"),tbody=document.getElementById("rows");
 const token=localStorage.getItem("pvFoxAccessToken");
 if(!token){status.textContent="Connect FOX Cloud in the V3 preview first (same GitHub Pages origin).";return;}
 status.textContent="Retrieving measurements...";tbody.replaceChildren();
 try{
  const dates=Array.from({length:6},(_,i)=>"2026-10-"+String(26+i).padStart(2,"0"));
  const result=await auditSoc(async date=>{
   const response=await fetch("https://fox-pv-connector.peter-droegemueller.workers.dev/history?date="+date,{headers:{Authorization:"Bearer "+token},cache:"no-store"});
   if(!response.ok)throw Error(date+": HTTP "+response.status);
   return response.json();
  },dates);
  for(const x of result){
   const tr=document.createElement("tr");
   for(const value of [x.date,x.count,x.soc===null?"No close reading":x.soc+"%",x.offsetMinutes===null?"—":x.offsetMinutes.toFixed(1),x.maxGapMinutes===null?"—":x.maxGapMinutes.toFixed(1)]){
    const td=document.createElement("td");td.textContent=String(value);tr.append(td);
   }tbody.append(tr);
  }
  const forecastRows=document.getElementById("forecastRows");
  const forecastStatus=document.getElementById("forecastStatus");
  if(forecastRows&&forecastStatus){
   forecastRows.replaceChildren();
   const archive=JSON.parse(localStorage.getItem("pvSocForecastArchiveV3")||"{}");
   let matches=0;
   for(const x of result){
    const predicted=archive[x.date]?.socAt16;
    const valid=Number.isFinite(predicted)&&x.soc!==null;
    if(valid)matches++;
    const tr=document.createElement("tr");
    const values=[x.date,Number.isFinite(predicted)?predicted+"%":"Not archived",x.soc===null?"Unavailable":x.soc+"%",valid?(x.soc-predicted)+" percentage points":"—"];
    for(const value of values){const td=document.createElement("td");td.textContent=value;tr.append(td);}
    forecastRows.append(tr);
   }
   forecastStatus.textContent=matches+" matched forecast/actual SOC pairs. New predictions are saved on this browser only.";
  }
  status.textContent="Complete: "+result.filter(x=>x.soc!==null).length+" of "+result.length+" days have an SOC measurement within 15 minutes of 16:00 UTC.";
 }catch(error){status.textContent="Analysis failed: "+error.message;}
};
