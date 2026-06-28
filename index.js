const express = require("express");
const app = express();

const channels = {
  HubSensasiHD:
    "https://ucdn.starhubgo.com/bpk-tv/HubSensasiHD/output/manifest.mpd"
};

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

    let data = await response.text();

    // =========================
    // FIX 1: remove BaseURL tag (important for OTT)
    // =========================
    data = data.replace(/<BaseURL>.*?<\/BaseURL>/g, "");

    // =========================
    // FIX 2: rewrite absolute CDN to proxy
    // =========================
    data = data.replaceAll(
      "https://ucdn.starhubgo.com",
      `${req.protocol}://${req.get("host")}/api/proxy`
    );

    // =========================
    // FIX 3: force relative segment handling
    // =========================
    data = data.replaceAll(
      '"/',
      `"${req.protocol}://${req.get("host")}/api/proxy/https://ucdn.starhubgo.com/`
    );

    res.setHeader("Content-Type", "application/dash+xml");
    res.setHeader("Access-Control-Allow-Origin", "*");

    res.send(data);

  } catch (err) {
    res.status(500).send("Crash: " + err.toString());
  }
});

// =========================
// FULL REVERSE PROXY (SEGMENTS)
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
    if (contentType) res.setHeader("Content-Type", contentType);

    res.setHeader("Access-Control-Allow-Origin", "*");

    res.send(Buffer.from(data));

  } catch (err) {
    res.status(500).send("Crash: " + err.toString());
  }
});

const port = process.env.PORT || 3000;

app.listen(port, "0.0.0.0", () => {
  console.log("Server running on port", port);
});
