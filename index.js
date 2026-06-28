const express = require("express");
const app = express();

const channels = {
  HubSensasiHD:
    "https://ucdn.starhubgo.com/bpk-tv/HubSensasiHD/output/manifest.mpd"
};

// =========================
// MANIFEST PROXY (SAFE)
// =========================
app.get("/api/proxy", async (req, res) => {
  try {
    const channel = req.query.channel;
    const url = channels[channel] || req.query.url;

    if (!url) {
      return res.status(400).send("Missing URL or channel");
    }

    const response = await fetch(url);

    if (!response.ok) {
      return res
        .status(response.status)
        .send("Upstream error: " + response.status);
    }

    const data = await response.text();

    // IMPORTANT:
    // ❌ NO XML MODIFYING HERE
    // ONLY RETURN ORIGINAL MPD
    res.setHeader("Content-Type", "application/dash+xml");
    res.setHeader("Access-Control-Allow-Origin", "*");

    res.send(data);

  } catch (err) {
    res.status(500).send("Crash: " + err.toString());
  }
});

// =========================
// SEGMENT PROXY (REQUIRED FOR OTT)
// =========================
app.get("/api/proxy/*", async (req, res) => {
  try {
    const url = req.params[0];

    if (!url || !url.startsWith("http")) {
      return res.status(400).send("Invalid URL");
    }

    const response = await fetch(url);

    if (!response.ok) {
      return res
        .status(response.status)
        .send("Upstream error: " + response.status);
    }

    const data = await response.arrayBuffer();

    const contentType = response.headers.get("content-type");

    if (contentType) {
      res.setHeader("Content-Type", contentType);
    }

    res.setHeader("Access-Control-Allow-Origin", "*");

    res.send(Buffer.from(data));

  } catch (err) {
    res.status(500).send("Crash: " + err.toString());
  }
});

// =========================
// PORT (RAILWAY)
// =========================
const port = process.env.PORT || 3000;

app.listen(port, "0.0.0.0", () => {
  console.log("Server running on port", port);
});
