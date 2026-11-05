
(async () => {
  const panel = document.createElement("section");
  panel.className = "card";
  panel.innerHTML =
    "<h3>Build 58 — hourly mean validation</h3>" +
    '<div id="mean58">Loading FOX history…</div>';
  document.body.append(panel);

  const out = document.getElementById("mean58");
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
    const original = (await response.json()).hours;

    let learned;
    for (let i = 0; i < 120; i++) {
      learned = window.__pvLoadLearning53;
      if (learned && learned.status !== "loading") break;
      await new Promise(r => setTimeout(r, 500));
    }
    if (!learned || learned.status !== "ready") {
      throw Error("Median learning not ready");
    }

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

      const slots = new Map();
      const records = (await r.json()).measurements || [];

      for (const x of records) {
        const power = Number(x.house_power_kw);
        const ms = Date.parse(x.recorded_at);
        if (x.house_power_kw == null ||
            !Number.isFinite(power) ||
            power < 0 || power > 20 ||
            !Number.isFinite(ms)) continue;

        const t = new Date(ms);
        if (t.toISOString().slice(0, 10) !== date) continue;

        const slot = t.getUTCHours() * 4 +
          Math.floor(t.getUTCMinutes() / 15);
        if (!slots.has(slot)) slots.set(slot, []);
        slots.get(slot).push(power);
      }

      if (slots.size < 90) continue;

      const hourly = Array.from(
        { length: 24 }, () => []
      );
      let actual = 0;

      for (const [slot, values] of slots) {
        const p = values.reduce((a, b) => a + b, 0)
          / values.length;
        hourly[Math.floor(slot / 4)].push(p);
        actual += p / 4;
      }
      days.push({ actual, hourly });
    }

    if (days.length < 5) {
      throw Error("Insufficient complete days");
    }

    const means = Array.from({ length: 24 }, (_, h) => {
      const values = days.map(d => d.hourly[h]);
      if (values.some(v => !v.length)) return null;
      return values.reduce((s, v) =>
        s + v.reduce((a, b) => a + b, 0) / v.length,
        0
      ) / values.length;
    });

    if (means.includes(null)) {
      throw Error("Incomplete hourly coverage");
    }

    const sum = p => p.reduce(
      (s, x) => s + Number(x.avg_power_kw), 0
    );

    const models = [
      ["Original FOX", sum(original)],
      ["Learned median", sum(learned.profile)],
      ["Hourly mean", means.reduce((a, b) => a + b, 0)]
    ];

    const mae = p => days.reduce(
      (s, d) => s + Math.abs(d.actual - p), 0
    ) / days.length;

    const table = document.createElement("table");
    table.innerHTML =
      "<tr><th>Model</th><th>kWh/day</th>" +
      "<th>Mean absolute error</th></tr>";

    for (const [name, predicted] of models) {
      const row = document.createElement("tr");
      for (const value of [
        name,
        predicted.toFixed(2),
        mae(predicted).toFixed(2)
      ]) {
        const cell = document.createElement("td");
        cell.textContent = value;
        row.append(cell);
      }
      table.append(row);
    }

    const note = document.createElement("p");
    note.className = "small";
    note.textContent =
      days.length + " non-Sunday days. " +
      "Diagnostic only; in-sample comparison. " +
      "No changes to battery planning or inverter settings.";

    out.replaceChildren(table, note);
  } catch (e) {
    out.textContent = "Build 58: " + e.message;
  }
})();
