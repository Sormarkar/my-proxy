const express = require("express");
const app = express();

const channels = {
  HubSensasiHD:
    "https://ucdn.starhubgo.com/bpk-tv/HubSensasiHD/output/manifest.mpd"
};

// =========================
// PROXY
// =========================
app.get("/api/proxy", async (req, res) => {
  try {
    const channel = req.query.channel;
    const url = channels[channel] || req.query.url;

    if (!url) {
      return res.status(400).send("Missing URL or channel");
    }

    // =========================
    // TIMEOUT CONTROLLER
    // =========================
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    // =========================
    // FETCH WITH HEADERS
    // =========================
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "*/*",
        "Referer": "https://google.com",
        "Origin": "https://google.com"
      }
    });

    clearTimeout(timeout);

    // =========================
    // DEBUG LOG (RAILWAY)
    // =========================
    console.log("UPSTREAM STATUS:", response.status);

    if (!response.ok) {
      return res
        .status(response.status)
        .send("Upstream error: " + response.status);
    }

    const data = await response.text();

    res.setHeader("Content-Type", "application/dash+xml");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "no-cache");

    res.send(data);

  } catch (err) {
    console.log("ERROR:", err.message);
    res.status(500).send("Crash: " + err.message);
  }
});

// =========================
// SERVER
// =========================
const port = process.env.PORT || 3000;

app.listen(port, "0.0.0.0", () => {
  console.log("Server running on port", port);
});
