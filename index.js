const express = require("express");
const app = express();

const fetch = globalThis.fetch;

const channels = {
  HubSensasiHD:
    "https://ucdn.starhubgo.com/bpk-tv/HubSensasiHD/output/manifest.mpd"
};

/* =========================
   CORS BASIC
========================= */
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  next();
});

/* =========================
   MPD CLEAN PROXY (SAFE REWRITE ONLY)
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
       ONLY REWRITE SEGMENT LINKS
       (NO UTCTiming, NO SCHEMA, NO DRM TOUCH)
    ========================= */
    mpd = mpd.replace(
      /(https?:\/\/[^"\s]+?\.(m4s|mp4|dash))/g,
      (match) => {
        return `${proxyBase}/api/segment?url=${encodeURIComponent(match)}`;
      }
    );

    /* OPTIONAL: handle media="relative paths" ONLY */
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
   SEGMENT PROXY (STABLE)
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

    res.setHeader(
      "Content-Type",
      upstream.headers.get("content-type") || "application/octet-stream"
    );

    res.setHeader("Cache-Control", "public, max-age=30");

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
  console.log("CLEAN DASH PROXY RUNNING:", port);
});
