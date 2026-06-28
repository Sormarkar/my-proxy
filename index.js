const express = require("express");
const app = express();

/* =========================
   FIX FETCH FOR RAILWAY
========================= */
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

/* =========================
   CHANNEL LIST
========================= */
const channels = {
  HubSensasiHD:
    "https://ucdn.starhubgo.com/bpk-tv/HubSensasiHD/output/manifest.mpd"
};

/* =========================
   GLOBAL CORS
========================= */
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "*");
  next();
});

/* =========================
   MPD PROXY + REWRITE
========================= */
app.get("/api/proxy", async (req, res) => {
  try {
    const url = channels[req.query.channel] || req.query.url;
    if (!url) return res.status(400).send("Missing URL");

    const upstream = await fetch(url);

    if (!upstream.ok) {
      return res.status(upstream.status).send("Upstream " + upstream.status);
    }

    let mpd = await upstream.text();

    const proxyBase = `${req.protocol}://${req.get("host")}`;

    /* =========================
       REWRITE ALL URLS IN MPD
    ========================= */
    mpd = mpd.replace(/https?:\/\/[^"\s]+/g, (u) => {
      return `${proxyBase}/api/segment?url=${encodeURIComponent(u)}`;
    });

    /* fix relative media="..." */
    mpd = mpd.replace(/media="([^"]+)"/g, (m, p1) => {
      const full = new URL(p1, url).href;
      return `media="${proxyBase}/api/segment?url=${encodeURIComponent(full)}"`;
    });

    res.setHeader("Content-Type", "application/dash+xml");
    res.send(mpd);

  } catch (err) {
    console.log("MPD ERROR:", err);
    res.status(500).send("MPD crash");
  }
});

/* =========================
   SEGMENT PROXY
========================= */
app.get("/api/segment", async (req, res) => {
  try {
    const url = req.query.url;
    if (!url) return res.status(400).send("Missing URL");

    const upstream = await fetch(url);

    if (!upstream.ok) {
      return res.status(upstream.status).send("Segment " + upstream.status);
    }

    const buffer = Buffer.from(await upstream.arrayBuffer());

    res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/octet-stream");
    res.setHeader("Cache-Control", "public, max-age=60");

    res.end(buffer);

  } catch (err) {
    console.log("SEGMENT ERROR:", err);
    res.status(500).send("Segment crash");
  }
});

/* =========================
   START SERVER
========================= */
const port = process.env.PORT || 3000;

app.listen(port, "0.0.0.0", () => {
  console.log("DASH proxy running on port", port);
});
