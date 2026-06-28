const express = require("express");
const app = express();

const channels = {
  HubSensasiHD:
    "https://ucdn.starhubgo.com/bpk-tv/HubSensasiHD/output/manifest.mpd"
};

/* =========================
   HELPER: FETCH MPD
========================= */
async function fetchMPD(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("MPD fetch failed: " + res.status);
  return await res.text();
}

/* =========================
   REWRITE MPD (IMPORTANT)
   - force all segments go through proxy
========================= */
function rewriteMPD(mpdText, baseUrl, req) {
  const proxyBase = `${req.protocol}://${req.get("host")}`;

  return mpdText
    // rewrite init / media / segments
    .replace(/(https?:\/\/[^"\s]+)/g, (match) => {
      return `${proxyBase}/api/segment?url=${encodeURIComponent(match)}`;
    })
    // handle relative paths (simple fix)
    .replace(/media="([^"]+)"/g, (m, p1) => {
      const full = new URL(p1, baseUrl).href;
      return `media="${proxyBase}/api/segment?url=${encodeURIComponent(full)}"`;
    });
}

/* =========================
   MPD PROXY
========================= */
app.get("/api/proxy", async (req, res) => {
  try {
    const channel = req.query.channel;
    const url = channels[channel] || req.query.url;

    if (!url) return res.status(400).send("Missing URL");

    const mpd = await fetchMPD(url);
    const rewritten = rewriteMPD(mpd, url, req);

    res.setHeader("Content-Type", "application/dash+xml");
    res.setHeader("Access-Control-Allow-Origin", "*");

    res.send(rewritten);
  } catch (err) {
    res.status(500).send("Crash: " + err.toString());
  }
});

/* =========================
   SEGMENT PROXY
========================= */
app.get("/api/segment", async (req, res) => {
  try {
    const url = req.query.url;
    if (!url) return res.status(400).send("Missing segment URL");

    const upstream = await fetch(url);

    if (!upstream.ok) {
      return res.status(upstream.status).send("Segment error " + upstream.status);
    }

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/octet-stream");

    const buffer = Buffer.from(await upstream.arrayBuffer());
    res.send(buffer);

  } catch (err) {
    res.status(500).send("Segment crash: " + err.toString());
  }
});

/* =========================
   START SERVER
========================= */
const port = process.env.PORT || 3000;

app.listen(port, "0.0.0.0", () => {
  console.log("DASH proxy running on port", port);
});
