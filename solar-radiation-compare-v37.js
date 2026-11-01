// Build 37: independent, read-only direct/diffuse PV forecast comparison.
// This does not change the overnight charging algorithm or its saved forecasts.
(async function(){
 const anchor=document.getElementById("forecast");
 if(!anchor)return;
 const card=document.createElement("div");card.className="card";
 card.innerHTML='<b>Solar model comparison — Build 37</b><div id="radiationCompare" class="sub">Calculating direct/diffuse forecast…</div><div class="small">Experimental diagnostic. Uses separate direct and diffuse radiation, roof geometry and temperature. Overnight charging still uses the original model.</div>';
 anchor.closest(".card").after(card);
 const out=document.getElementById("radiationCompare");
 const dateUK=d=>new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/London",year:"numeric",month:"2-digit",day:"2-digit"}).format(d);
 const d=new Date();d.setUTCDate(d.getUTCDate()+1);const target=dateUK(d);
 try{
  const url="https://api.open-meteo.com/v1/forecast?latitude="+C.lat+"&longitude="+C.lon+"&hourly=shortwave_radiation,direct_normal_irradiance,diffuse_radiation,temperature_2m&forecast_days=3&timezone=UTC";
  const res=await fetch(url);if(!res.ok)throw Error("Weather HTTP "+res.status);
  const j=await res.json();if(!j.hourly?.direct_normal_irradiance||!j.hourly?.diffuse_radiation)throw Error("Direct/diffuse data unavailable");
  const tilt=C.tilt*Math.PI/180,sky=(1+Math.cos(tilt))/2,ground=(1-Math.cos(tilt))/2;
  let newTotal=0,oldTotal=0,hours=0;
  for(let i=0;i<j.hourly.time.length;i++){
   const t=new Date(j.hourly.time[i]+":00Z");if(dateUK(t)!==target)continue;
   const solar=sun(t);if(solar.el<=0)continue;
   const ghi=Math.max(0,Number(j.hourly.shortwave_radiation[i])||0);
   const dni=Math.max(0,Number(j.hourly.direct_normal_irradiance[i])||0);
   const dhi=Math.max(0,Number(j.hourly.diffuse_radiation[i])||0);
   const amb=Number(j.hourly.temperature_2m[i])||10;
   const plane=(az,n)=>{
    const a=az*Math.PI/180;
    const incidence=Math.sin(solar.el)*Math.cos(tilt)+Math.cos(solar.el)*Math.sin(tilt)*Math.cos(solar.az-a);
    return n*C.panelW/1000000*(dni*Math.max(0,incidence)+dhi*sky+ghi*.2*ground);
   };
   const p1=plane(C.az1,C.n1),p2=plane(C.az2,C.n2);
   const irradiance=Math.max(0,(p1+p2)*1e6/(C.panelW*(C.n1+C.n2)));
   const temp=Math.max(.75,1-.0029*Math.max(0,amb+.03*irradiance-25));
   newTotal+=Math.min(C.maxInv,(p1+p2)*temp*C.baseLoss*learned());
   const legacy1=poa(ghi,t,C.az1)*C.n1*C.panelW/1e6;
   const legacy2=poa(ghi,t,C.az2)*C.n2*C.panelW/1e6;
   const legacyIrr=(poa(ghi,t,C.az1)+poa(ghi,t,C.az2))/2;
   const oldTemp=Math.max(.75,1-.0029*Math.max(0,amb+.03*legacyIrr-25));
   oldTotal+=Math.min(C.maxInv,(legacy1+legacy2)*oldTemp*C.baseLoss*learned());
   hours++;
  }
  if(!hours)throw Error("No tomorrow daylight hours");
  const delta=newTotal-oldTotal;
  out.textContent="Tomorrow "+target+": original hourly model "+oldTotal.toFixed(1)+" kWh; direct/diffuse model "+newTotal.toFixed(1)+" kWh; difference "+(delta>=0?"+":"")+delta.toFixed(1)+" kWh. Compare against FOX actual before adopting.";
 }catch(e){out.textContent="Comparison unavailable: "+e.message;}
})();
