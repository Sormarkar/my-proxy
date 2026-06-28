const express = require("express");
const app = express();
const { Readable } = require("stream");

const channels = {
  HubSensasiHD:
    "https://ucdn.starhubgo.com/bpk-tv/HubSensasiHD/output/manifest.mpd"
};

// =========================
// MPD PROXY
// =========================
app.get("/api/proxy", async (req, res) => {
  try {
    const channel = req.query.channel;
    const url = channels[channel] || req.query.url;

    if (!url) {
      return res.status(400).send("Missing URL or channel");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

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

    console.log("MPD STATUS:", response.status);

    if (!response.ok) {
      return res.status(response.status).send("Upstream error: " + response.status);
    }

    let mpd = await response.text();

    const proxyBase = `${req.protocol}://${req.get("host")}/api/segment?url=`;
    const base = url.substring(0, url.lastIndexOf("/") + 1);

    // =========================
    // REWRITE SEGMENT URLS (IMPORTANT)
    // =========================
    mpd = mpd.replace(
      /initialization="([^"]+)"/g,
      (_, p1) => {
        const full = p1.startsWith("http") ? p1 : new URL(p1, base).href;
        return `initialization="${proxyBase}${encodeURIComponent(full)}"`;
      }
    );

    mpd = mpd.replace(
      /media="([^"]+)"/g,
      (_, p1) => {
        const full = p1.startsWith("http") ? p1 : new URL(p1, base).href;
        return `media="${proxyBase}${encodeURIComponent(full)}"`;
      }
    );

    res.setHeader("Content-Type", "application/dash+xml");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "no-cache");

    res.send(mpd);

  } catch (err) {
    console.log("MPD ERROR:", err.message);
    res.status(500).send("Crash: " + err.message);
  }
});

// =========================
// SEGMENT PROXY (IMPORTANT)
// =========================
app.get("/api/segment", async (req, res) => {
  const url = req.query.url;

  if (!url) return res.status(400).send("Missing url");

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "*/*",
        "Referer": "https://google.com"
      }
    });

    clearTimeout(timeout);

    console.log("SEGMENT STATUS:", response.status);

    res.status(response.status);

    response.headers.forEach((v, k) => {
      const key = k.toLowerCase();

      if (!["content-encoding", "transfer-encoding", "content-length"].includes(key)) {
        res.setHeader(k, v);
      }
    });

    if (!response.body) return res.end();

    const stream = Readable.fromWeb(response.body);
    stream.pipe(res);

  } catch (err) {
    console.log("SEGMENT ERROR:", err.message);
    res.status(500).send("Segment failed: " + err.message);
  }
});

// =========================
// SERVER
// =========================
const port = process.env.PORT || 3000;

app.listen(port, "0.0.0.0", () => {
  console.log("OTT Proxy running on port", port);
});
