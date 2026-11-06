// Build 60 — read-only comparison of ECMWF and DWD ICON solar forecasts.
(async () => {
  const panel = document.createElement("section");
  panel.className = "card";
  panel.innerHTML = '<h3>Build 60 — ECMWF vs DWD ICON</h3><div id="weather60">Loading weather forecasts…</div>';
  document.body.append(panel);
  const out = document.getElementById("weather60");
  const models = [["ECMWF IFS", "ecmwf_ifs025"], ["DWD ICON", "icon_d2"]];
  const dateUK = d => new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit"
  }).format(d);
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const target = dateUK(tomorrow);
  const ukHour = d => Number(new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London", hour: "2-digit", hourCycle: "h23"
  }).format(d));
  const tilt = C.tilt * Math.PI / 180;
  const sky = (1 + Math.cos(tilt)) / 2;
  const ground = (1 - Math.cos(tilt)) / 2;
  async function calculate(name, model) {
    const params = new URLSearchParams({
      latitude: String(C.lat), longitude: String(C.lon), models: model,
      hourly: "shortwave_radiation,direct_normal_irradiance,diffuse_radiation,temperature_2m",
      forecast_days: "3", timezone: "UTC"
    });
    const response = await fetch("https://api.open-meteo.com/v1/forecast?" + params);
    if (!response.ok) throw Error("HTTP " + response.status);
    const data = (await response.json()).hourly;
    if (!data?.time || !data.direct_normal_irradiance || !data.diffuse_radiation)
      throw Error("Missing solar radiation fields");
    let full = 0, before16 = 0, points = 0;
    for (let i = 0; i < data.time.length; i++) {
      const t = new Date(data.time[i] + ":00Z");
      if (dateUK(t) !== target) continue;
      const s = sun(t);
      if (s.el <= 0) continue;
      const ghi = Math.max(0, Number(data.shortwave_radiation[i]) || 0);
      const dni = Math.max(0, Number(data.direct_normal_irradiance[i]) || 0);
      const dhi = Math.max(0, Number(data.diffuse_radiation[i]) || 0);
      const ambient = Number(data.temperature_2m[i]);
      if (!Number.isFinite(ambient)) throw Error("Missing temperature");
      const face = (azimuth, panels) => {
        const az = azimuth * Math.PI / 180;
        const incidence = Math.sin(s.el) * Math.cos(tilt) +
          Math.cos(s.el) * Math.sin(tilt) * Math.cos(s.az - az);
        return panels * C.panelW / 1e6 *
          (dni * Math.max(0, incidence) + dhi * sky + ghi * 0.2 * ground);
      };
      const raw = face(C.az1, C.n1) + face(C.az2, C.n2);
      const temp = Math.max(0.75, 1 - 0.0029 * Math.max(0, ambient + 0.03 * (ghi) - 25));
      const energy = Math.min(C.maxInv, raw * temp * C.baseLoss);
      full += energy;
      if (ukHour(t) < 16) before16 += energy;
      points++;
    }
    if (!points) throw Error("No daylight data");
    return { name, full, before16 };
  }
  const results = await Promise.all(models.map(async ([name, id]) => {
    try { return await calculate(name, id); }
    catch (e) { return { name, error: e.message }; }
  }));
  const table = document.createElement("table");
  table.innerHTML = "<tr><th>Weather model</th><th>PV to 16:00</th><th>PV full day</th></tr>";
  for (const r of results) {
    const tr = document.createElement("tr");
    for (const value of [r.name, r.error ? "Unavailable" : r.before16.toFixed(2) + " kWh",
      r.error ? r.error : r.full.toFixed(2) + " kWh"]) {
      const td = document.createElement("td");
      td.textContent = value;
      tr.append(td);
    }
    table.append(tr);
  }
  const note = document.createElement("p");
  note.className = "small";
  note.textContent = "Target " + target + ". Same roof/temperature conversion for both models. " +
    "No historical accuracy conclusion yet. Read-only; no changes to battery planning. " +
    "Forecast values are not archived by this panel.";
  out.replaceChildren(table, note);
})();