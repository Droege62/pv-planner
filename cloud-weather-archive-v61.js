// Build 61: manual, authenticated Cloudflare D1 archive for tomorrow's model forecasts.
// Read-only FOX; writes only weather_model_forecasts after the user presses Save.
(() => {
  const section = document.createElement("section");
  section.className = "card";
  section.innerHTML = '<h3>Build 61 — Cloudflare weather archive</h3><p class="small">Save tomorrow\'s ECMWF and DWD ICON forecasts to D1. The forecast issue time is recorded; saved records are never overwritten. No changes to FOX inverter controls or charging advice.</p><button id="weatherSave61" type="button">Save tomorrow\'s weather forecasts</button><div id="weatherStatus61" class="small">Not saved yet.</div>';
  document.body.append(section);
  const button = document.getElementById("weatherSave61");
  const status = document.getElementById("weatherStatus61");
  const endpoint = "https://fox-pv-connector.peter-droegemueller.workers.dev/weather-model-forecasts";
  const models = [["ECMWF IFS", "ecmwf_ifs025"], ["DWD ICON", "icon_d2"]];
  const dayUK = d => new Intl.DateTimeFormat("en-CA", {timeZone:"Europe/London",year:"numeric",month:"2-digit",day:"2-digit"}).format(d);
  const hourUK = d => Number(new Intl.DateTimeFormat("en-GB", {timeZone:"Europe/London",hour:"2-digit",hourCycle:"h23"}).format(d));
  async function predict(model, target, issuedAt) {
    const query = new URLSearchParams({
      latitude: String(C.lat), longitude: String(C.lon), models:model,
      hourly:"shortwave_radiation,direct_normal_irradiance,diffuse_radiation,temperature_2m",
      forecast_days:"3", timezone:"UTC"
    });
    const res = await fetch("https://api.open-meteo.com/v1/forecast?" + query, {cache:"no-store"});
    if (!res.ok) throw Error(model + " weather HTTP " + res.status);
    const data = (await res.json()).hourly;
    if (!data || !Array.isArray(data.time) || !Array.isArray(data.direct_normal_irradiance) ||
        !Array.isArray(data.diffuse_radiation) || !Array.isArray(data.shortwave_radiation) ||
        !Array.isArray(data.temperature_2m)) throw Error(model + " missing irradiance fields");
    const tilt = C.tilt * Math.PI / 180;
    const sky = (1 + Math.cos(tilt)) / 2;
    const ground = (1 - Math.cos(tilt)) / 2;
    const hourly = [];
    let full = 0, before16 = 0;
    for (let i=0; i<data.time.length; i++) {
      const t = new Date(data.time[i] + ":00Z");
      if (dayUK(t) !== target) continue;
      const s = sun(t);
      let energy = 0;
      if (s.el > 0) {
        const ghi = Math.max(0, Number(data.shortwave_radiation[i]) || 0);
        const dni = Math.max(0, Number(data.direct_normal_irradiance[i]) || 0);
        const dhi = Math.max(0, Number(data.diffuse_radiation[i]) || 0);
        const ambient = Number(data.temperature_2m[i]);
        if (!Number.isFinite(ambient)) throw Error(model + " missing temperature");
        const face = (azimuth, panels) => {
          const az = azimuth * Math.PI / 180;
          const incidence = Math.sin(s.el)*Math.cos(tilt) +
            Math.cos(s.el)*Math.sin(tilt)*Math.cos(s.az-az);
          return panels*C.panelW/1e6 *
            (dni*Math.max(0,incidence) + dhi*sky + ghi*0.2*ground);
        };
        const raw = face(C.az1,C.n1)+face(C.az2,C.n2);
        const temp = Math.max(0.75,1-0.0029*Math.max(0,ambient+0.03*ghi-25));
        energy = Math.max(0,Math.min(C.maxInv,raw*temp*C.baseLoss));
      }
      full += energy;
      if (hourUK(t) < 16) before16 += energy;
      hourly.push({time:t.toISOString(),pvKwh:Number(energy.toFixed(5))});
    }
    if (hourly.length < 23 || hourly.length > 25) throw Error(model + " incomplete target-day hours");
    return {
      targetDate:target,modelId:model,issuedAt,
      pvBefore16Kwh:Number(before16.toFixed(5)),
      pvDailyKwh:Number(full.toFixed(5)),
      hourly,conversionVersion:"v60-roof-model-1"
    };
  }
  button.addEventListener("click", async () => {
    const token = localStorage.getItem("pvFoxAccessToken");
    if (!token) { status.textContent="Connect FOX Cloud first, then try again."; return; }
    button.disabled = true;
    status.textContent = "Fetching and saving both forecasts…";
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate()+1);
    const target = dayUK(tomorrow);
    const issuedAt = new Date().toISOString();
    const headers = {Authorization:"Bearer "+token,"Content-Type":"application/json"};
    const lines = [];
    for (const [name,id] of models) {
      try {
        const record = await predict(id,target,issuedAt);
        const response = await fetch(endpoint,{method:"POST",headers,body:JSON.stringify(record),cache:"no-store"});
        const result = await response.json().catch(()=>({}));
        if (!response.ok) throw Error("HTTP "+response.status+" "+(result.error||""));
        lines.push(name+": "+(result.stored?"saved":result.alreadyExists?"already saved":"response unclear")+
          " ("+record.pvBefore16Kwh.toFixed(2)+" kWh to 16:00)");
      } catch (error) { lines.push(name+": ERROR — "+error.message); }
    }
    status.textContent = "Target "+target+"; "+lines.join("; ");
    button.disabled = false;
  });
})();
