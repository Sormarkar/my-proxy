const express = require("express");
const app = express();

const channels = {
  HubSensasiHD:
    "https://ucdn.starhubgo.com/bpk-tv/HubSensasiHD/output/manifest.mpd"
};

// =========================
// MANIFEST
// =========================
app.get("/api/proxy", async (req, res) => {
  try {
    const channel = req.query.channel;
    const url = channels[channel] || req.query.url;

    if (!url) return res.status(400).send("Missing URL");

    const response = await fetch(url);

    if (!response.ok) {
      return res.status(response.status).send("Upstream error");
    }

    const data = await response.text();

    res.setHeader("Content-Type", "application/dash+xml");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "no-cache");

    res.send(data);

  } catch (err) {
    res.status(500).send(err.toString());
  }
});

// =========================
// STREAM (PHP STYLE CLONE)
// =========================
app.get("/api/proxy/*", async (req, res) => {
  try {
    let url = req.params[0];

    const qs = req.url.split("?")[1];
    if (qs) url += "?" + qs;

    if (!url || !url.startsWith("http")) {
      return res.status(400).send("Invalid URL");
    }

    const headers = {
      "User-Agent": "Mozilla/5.0",
      "Accept": "*/*",
      "Connection": "keep-alive"
    };

    if (req.headers.range) {
      headers["Range"] = req.headers.range;
    }

    const response = await fetch(url, { headers });

    // pass status like PHP curl
    res.status(response.status);

    // pass important headers
    const passHeaders = [
      "content-type",
      "content-length",
      "content-range",
      "accept-ranges",
      "etag",
      "last-modified"
    ];

    passHeaders.forEach(h => {
      const val = response.headers.get(h);
      if (val) res.setHeader(h, val);
    });

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "no-cache");

    // STREAM like PHP (NOT buffer)
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
