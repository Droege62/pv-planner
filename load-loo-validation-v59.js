
(async () => {
  const panel = document.createElement("section");
  panel.className = "card";
  panel.innerHTML =
    "<h3>Build 59 — out-of-sample load validation</h3>" +
    '<div id="load59">Loading FOX history…</div>';
  document.body.append(panel);

  const out = document.getElementById("load59");
  const token = localStorage.getItem("pvFoxAccessToken");
  if (!token) {
    out.textContent = "Connect FOX Cloud first.";
    return;
  }

  const base =
    "https://fox-pv-connector.peter-droegemueller.workers.dev";
  const opts = {
    headers: { Authorization: "Bearer " + token },
    cache: "no-store"
  };

  try {
    const response = await fetch(
      base + "/consumption-profile", opts
    );
    if (!response.ok) throw Error("FOX profile unavailable");

    const original = (await response.json()).hours
      .map(x => Number(x.avg_power_kw));

    const days = [];

    for (let i = 1; i <= 14; i++) {
      const d = new Date();
      d.setUTCHours(12, 0, 0, 0);
      d.setUTCDate(d.getUTCDate() - i);
      if (d.getUTCDay() === 0) continue;

      const date = d.toISOString().slice(0, 10);
      const r = await fetch(
        base + "/history?date=" + date, opts
      );
      if (!r.ok) continue;

      const records = (await r.json()).measurements || [];
      const slots = new Map();

      for (const x of records) {
        const p = Number(x.house_power_kw);
        const ms = Date.parse(x.recorded_at);

        if (x.house_power_kw == null ||
            !Number.isFinite(p) || p < 0 || p > 20 ||
            !Number.isFinite(ms)) continue;

        const t = new Date(ms);
        if (t.toISOString().slice(0, 10) !== date) continue;

        const slot = t.getUTCHours() * 4 +
          Math.floor(t.getUTCMinutes() / 15);

        if (!slots.has(slot)) slots.set(slot, []);
        slots.get(slot).push(p);
      }

      if (slots.size < 90) continue;

      const hourly = Array.from(
        { length: 24 }, () => []
      );

      for (const [slot, values] of slots) {
        const p = values.reduce((a, b) => a + b, 0)
          / values.length;
        hourly[Math.floor(slot / 4)].push(p);
      }

      if (hourly.some(a => a.length < 3)) continue;

      const actual = hourly.map(a =>
        a.reduce((s, x) => s + x, 0) / a.length
      );
      days.push({ date, actual });
    }

    if (days.length < 5) {
      throw Error("Insufficient complete days");
    }

    const sum = (p, start, end) =>
      p.slice(start, end).reduce((s, x) => s + x, 0);

    const models = [
      { name: "Original FOX", full: [], daytime: [] },
      { name: "Hourly mean (LOO)", full: [], daytime: [] }
    ];

    for (let i = 0; i < days.length; i++) {
      const training = days.filter((_, j) => j !== i);

      const mean = Array.from({ length: 24 }, (_, h) =>
        training.reduce(
          (s, d) => s + d.actual[h], 0
        ) / training.length
      );

      for (const [k, prediction] of
        [original, mean].entries()) {
        const actual = days[i].actual;

        models[k].full.push(Math.abs(
          sum(prediction, 0, 24) - sum(actual, 0, 24)
        ));

        models[k].daytime.push(Math.abs(
          sum(prediction, 5, 16) - sum(actual, 5, 16)
        ));
      }
    }

    const avg = values =>
      values.reduce((s, x) => s + x, 0) / values.length;

    const table = document.createElement("table");
    table.innerHTML =
      "<tr><th>Model</th><th>Daily MAE</th>" +
      "<th>05–16 MAE</th></tr>";

    for (const m of models) {
      const tr = document.createElement("tr");
      for (const value of [
        m.name,
        avg(m.full).toFixed(2) + " kWh",
        avg(m.daytime).toFixed(2) + " kWh"
      ]) {
        const td = document.createElement("td");
        td.textContent = value;
        tr.append(td);
      }
      table.append(tr);
    }

    const note = document.createElement("p");
    note.className = "small";
    note.textContent =
      days.length + " non-Sunday days. " +
      "Hourly mean trained without the test day. " +
      "05–16 uses UTC. Original FOX is a fixed baseline " +
      "with unknown training dates. Diagnostic only; " +
      "no changes to charging or inverter settings.";

    out.replaceChildren(table, note);

  } catch (e) {
    out.textContent = "Build 59: " + e.message;
  }
})();
