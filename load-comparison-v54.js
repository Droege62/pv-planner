
(async () => {
  const panel = document.createElement("section");
  panel.className = "card";
  panel.innerHTML =
    '<h3>Build 54 — household consumption comparison</h3>' +
    '<div id="compare54">Loading comparison...</div>';
  document.body.append(panel);

  const output = document.getElementById("compare54");
  const token = localStorage.getItem("pvFoxAccessToken");

  if (!token) {
    output.textContent = "Connect FOX Cloud first.";
    return;
  }

  try {
    const response = await fetch(
      "https://fox-pv-connector.peter-droegemueller.workers.dev/consumption-profile",
      {
        headers: { Authorization: "Bearer " + token },
        cache: "no-store"
      }
    );

    if (!response.ok) {
      throw new Error("FOX HTTP " + response.status);
    }

    const data = await response.json();
    const original = data.hours;

    // Wait for Build 53 to finish learning.
    let learned = null;

    for (let i = 0; i < 30; i++) {
      if (
        Array.isArray(foxConsumptionProfile) &&
        foxConsumptionProfile.length === 24
      ) {
        learned = foxConsumptionProfile;
        break;
      }

      await new Promise(resolve => setTimeout(resolve, 500));
    }

    if (!Array.isArray(original) || !learned) {
      throw new Error("Consumption profiles unavailable");
    }

    function energy(profile, start, end) {
      return profile
        .filter(item =>
          Number(item.utc_hour) >= start &&
          Number(item.utc_hour) < end
        )
        .reduce(
          (total, item) => total + Number(item.avg_power_kw),
          0
        );
    }

    const periods = [
      ["00:00–05:00", 0, 5],
      ["05:00–16:00", 5, 16],
      ["14:00–16:00", 14, 16],
      ["Full day", 0, 24]
    ];

    const table = document.createElement("table");

    table.innerHTML =
      "<tr><th>UTC period</th><th>Old FOX</th>" +
      "<th>Learned median</th><th>Difference</th></tr>";

    for (const [label, start, end] of periods) {
      const before = energy(original, start, end);
      const after = energy(learned, start, end);

      const row = document.createElement("tr");

      for (const value of [
        label,
        before.toFixed(2) + " kWh",
        after.toFixed(2) + " kWh",
        (after - before).toFixed(2) + " kWh"
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
      "Comparison of historical household consumption. " +
      "Build 53 uses the learned profile in V3. " +
      "The effect on predicted battery SOC and overnight " +
      "charging target will be checked separately.";

    output.replaceChildren(table, note);

  } catch (error) {
    output.textContent =
      "Comparison unavailable: " + error.message;
  }
})();
