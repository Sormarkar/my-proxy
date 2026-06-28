const express = require("express");
const app = express();

// =====================
// CHANNEL MAP
// =====================
const channels = {
  HubSensasiHD:
    "https://ucdn.starhubgo.com/bpk-tv/HubSensasiHD/output/manifest.mpd"
};

// =====================
// HELPER: detect full URL
// =====================
function getTarget(req) {
  const channel = req.query.channel;
  if (channel && channels[channel]) {
    return channels[channel];
  }

  const url = req.query.url;
  if (url) return url;

  const path = req.params[0];
  if (path && path.startsWith("http")) return path;

  return null;
}

// =====================
// MAIN PROXY (FULL PATH)
// =====================
app.get("/api/proxy/*", async (req, res) => {
  try {
    let url = getTarget(req);

    if (!url) {
      return res.status(400).send("Missing URL");
    }

    const response = await fetch(url);

    if (!response.ok) {
      return res.status(response.status).send("Upstream error");
    }

    // detect content type
    const contentType = response.headers.get("content-type");

    const data = await response.arrayBuffer();

    if (contentType) {
      res.setHeader("Content-Type", contentType);
    }

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.send(Buffer.from(data));

  } catch (err) {
    res.status(500).send("Crash: " + err.toString());
  }
});

// =====================
// PORT (IMPORTANT)
// =====================
const port = process.env.PORT || 3000;
app.listen(port, "0.0.0.0", () => {
  console.log("Server running on port", port);
});
