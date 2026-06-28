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
      return res.status(response.status).send("Upstream error");
    }

    // =========================
    // COPY HEADERS (IMPORTANT)
    // =========================
    const headers = [
      "content-type",
      "content-length",
      "content-range",
      "accept-ranges",
      "etag",
      "last-modified"
    ];

    headers.forEach((h) => {
      const val = response.headers.get(h);
      if (val) res.setHeader(h, val);
    });

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "no-cache");

    // =========================
    // STREAM LIKE PHP (CRITICAL FIX)
    // =========================
    const reader = response.body.getReader();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }

    res.end();

  } catch (err) {
    res.status(500).send("Crash: " + err.toString());
  }
});

// =========================
const port = process.env.PORT || 3000;
app.listen(port, "0.0.0.0", () => {
  console.log("Server running on port", port);
});
