const express = require("express");
const app = express();

/* =========================
   USE BUILTIN FETCH (NODE 18+)
========================= */
const fetch = globalThis.fetch;

const channels = {
  HubSensasiHD:
    "https://ucdn.starhubgo.com/bpk-tv/HubSensasiHD/output/manifest.mpd"
};

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  next();
});

/* =========================
   MPD PROXY
========================= */
app.get("/api/proxy", async (req, res) => {
  try {
    const url = channels[req.query.channel] || req.query.url;
    if (!url) return res.status(400).send("Missing URL");

    const upstream = await fetch(url);

    console.log("MPD STATUS:", upstream.status);

    if (!upstream.ok) {
      return res.status(upstream.status).send("Upstream " + upstream.status);
    }

    let mpd = await upstream.text();

    const base = `${req.protocol}://${req.get("host")}`;

    mpd = mpd.replace(/https?:\/\/[^"\s]+/g, (u) => {
      return `${base}/api/segment?url=${encodeURIComponent(u)}`;
    });

    res.setHeader("Content-Type", "application/dash+xml");
    res.send(mpd);

  } catch (e) {
    console.log("MPD ERROR:", e);
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

    console.log("SEG STATUS:", upstream.status);

    if (!upstream.ok) {
      return res.status(upstream.status).send("Segment " + upstream.status);
    }

    const buf = Buffer.from(await upstream.arrayBuffer());

    res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/octet-stream");
    res.end(buf);

  } catch (e) {
    console.log("SEG ERROR:", e);
    res.status(500).send("Segment crash");
  }
});

const port = process.env.PORT || 3000;
app.listen(port, "0.0.0.0", () => {
  console.log("RUNNING ON", port);
});
