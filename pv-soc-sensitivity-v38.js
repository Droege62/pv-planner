// Build 38: approximate PV shortfall sensitivity, read-only.
(()=>{
 const anchor=document.getElementById("peak");const pv=document.getElementById("pv16");
 if(!anchor||!pv)return;
 const card=document.createElement("div");card.className="card";
 card.innerHTML='<b>16:00 SOC sensitivity — Build 38</b><div id="pvRiskScenarios" class="sub">Waiting for battery forecast…</div><div class="small">Illustrative sensitivity only: assumes reduced PV before 16:00 would otherwise have charged the battery, at 97.5% charging efficiency. Not an hourly battery simulation or a charging recommendation.</div>';
 anchor.closest(".card").parentElement.after(card);
 const out=document.getElementById("pvRiskScenarios");
 function update(){
  const base=Number(anchor.textContent.match(/([0-9.]+)%/)?.[1]);
  const generation=Number(pv.textContent.match(/([0-9.]+)\s*kWh/)?.[1]);
  if(!Number.isFinite(base)||!Number.isFinite(generation))return;
  const capacity=11.52,eff=.975;
  const cases=[0,.1,.2,.3];
  const table=document.createElement("table");
  const head=document.createElement("tr");
  for(const label of ["PV shortfall","PV before 16:00","Indicative SOC"]){const th=document.createElement("th");th.textContent=label;th.style.textAlign="left";head.append(th);}table.append(head);
  for(const fraction of cases){
   const soc=Math.max(10,base-100*generation*fraction*eff/capacity);
   const tr=document.createElement("tr");
   for(const v of [Math.round(fraction*100)+"%",(generation*(1-fraction)).toFixed(1)+" kWh",Math.round(soc)+"%"]){const td=document.createElement("td");td.textContent=v;tr.append(td);}table.append(tr);
  }
  out.replaceChildren(table);
 }
 new MutationObserver(update).observe(anchor,{childList:true,characterData:true,subtree:true});
 new MutationObserver(update).observe(pv,{childList:true,characterData:true,subtree:true});
 update();
})();
