// Build 50: cloud-first backup for the first archived forecast for tomorrow.
// Uses the existing FOX access token; no inverter write calls.
(async()=>{
 const el=document.createElement("section");el.className="card";
 el.innerHTML='<h3>Cloudflare forecast archive — Build 50</h3><div id="cloudArchive50">Checking cloud archive…</div><p class="small">Cloud upload activates only after the Worker /forecasts endpoint and D1 table are installed. Browser archive remains as fallback. FOX inverter settings are never changed.</p>';
 document.body.append(el);
 const out=document.getElementById("cloudArchive50"),endpoint="https://fox-pv-connector.peter-droegemueller.workers.dev/forecasts";
 const token=localStorage.getItem("pvFoxAccessToken");
 if(!token){out.textContent="Connect FOX first; cloud sync not attempted.";return;}
 const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/London",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
 const date=new Date(today+"T12:00:00Z");date.setUTCDate(date.getUTCDate()+1);const tomorrow=date.toISOString().slice(0,10);
 const headers={Authorization:"Bearer "+token};
 try{
  const check=await fetch(endpoint,{headers,cache:"no-store"});
  if(check.status===404||check.status===405){out.textContent="Cloud storage not activated: Worker endpoint /forecasts needs deployment. Browser archiving continues.";return;}
  if(!check.ok){out.textContent="Cloud archive unavailable (HTTP "+check.status+"). Browser archive remains available.";return;}
  const data=await check.json();
  const existing=(data.forecasts||[]).find(x=>x.targetDate===tomorrow);
  if(existing){out.textContent="Cloud archive confirmed for "+tomorrow+" (saved "+existing.createdAt+").";return;}
  let local={};try{local=JSON.parse(localStorage.getItem("pvDetailedForecastArchiveV49")||"{}")}catch(e){}
  const record=local[tomorrow];
  if(!record){out.textContent="Cloud endpoint connected. Waiting for tomorrow's forecast to be archived locally; reload after forecast completes.";return;}
  const response=await fetch(endpoint,{method:"POST",headers:{...headers,"Content-Type":"application/json"},body:JSON.stringify(record)});
  if(!response.ok){out.textContent="Cloud upload not completed (HTTP "+response.status+"); local archive preserved.";return;}
  const result=await response.json();
  out.textContent=result.stored?"Forecast for "+tomorrow+" saved to Cloudflare D1.":"Forecast for "+tomorrow+" already stored in Cloudflare D1.";
 }catch(e){out.textContent="Cloud archive unavailable; browser archive preserved ("+e.message+").";}
})();
