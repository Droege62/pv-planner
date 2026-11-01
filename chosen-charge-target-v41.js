// Build 41: user-entered charging target, stored separately from the original forecast.
// Local browser only; no FOX inverter write commands.
(()=>{
 const forecast=document.getElementById("peak");if(!forecast)return;
 const card=document.createElement("section");card.className="card";
 card.innerHTML='<b>Record tonight\'s actual charging plan — Build 41</b><div class="small">Target date: <span id="planDate41"></span>. Enter the SOC target you actually set in FOX for the 02:00–05:00 window. This does not change your inverter.</div><label for="actualTarget41">Your overnight SOC target (%)</label><input id="actualTarget41" type="number" min="10" max="100" step="1" placeholder="e.g. 69"><button type="button" id="saveTarget41">Save chosen target</button><div id="targetStatus41" class="sub">No chosen target recorded yet.</div>';
 forecast.closest(".card").parentElement.after(card);
 const KEY="pvChosenOvernightTargetV41",dateEl=document.getElementById("planDate41"),field=document.getElementById("actualTarget41"),status=document.getElementById("targetStatus41");
 const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/London",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
 const next=new Date(today+"T12:00:00Z");next.setUTCDate(next.getUTCDate()+1);const date=next.toISOString().slice(0,10);dateEl.textContent=date;
 function read(){try{return JSON.parse(localStorage.getItem(KEY)||"{}")||{}}catch(e){return {}}}
 const old=read()[date];if(old){field.value=old.targetSoc;status.textContent="Saved target "+old.targetSoc+"% at "+old.savedAt+". You can correct it if needed.";}
 document.getElementById("saveTarget41").onclick=()=>{
  if(field.value.trim()===""){status.textContent="Enter the SOC target first.";return;}
  const value=Number(field.value);if(!Number.isInteger(value)||value<10||value>100){status.textContent="Enter a whole number between 10 and 100.";return;}
  const saved=read();saved[date]={targetSoc:value,savedAt:new Date().toISOString(),source:"User-entered FOX charging target (not verified by inverter)"};
  const keys=Object.keys(saved).sort();while(keys.length>120)delete saved[keys.shift()];
  localStorage.setItem(KEY,JSON.stringify(saved));status.textContent="Saved "+value+"% target for "+date+" on this browser. This does not change FOX settings.";
 };
})();
