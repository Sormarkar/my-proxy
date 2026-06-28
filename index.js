const express = require("express");
const app = express();

const fetch = global.fetch;

const channels = {
  HubSensasiHD:
    "https://ucdn.starhubgo.com/bpk-tv/HubSensasiHD/output/manifest.mpd"
};

// =========================
// MAIN PROXY (MANIFEST + SEGMENT)
// =========================
app.get("/api/proxy", async (req, res) => {
  try {
    const channel = req.query.channel;
    const baseUrl = channels[channel];

    const url = baseUrl || req.query.url;

    if (!url) {
      return res.status(400).send("Missing URL or channel");
    }

    const upstream = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "*/*"
      }
    });

    if (!upstream.ok) {
      return res
        .status(upstream.status)
        .send("Upstream error: " + upstream.status);
    }

    // =========================
    // COPY IMPORTANT HEADERS
    // =========================
    const contentType = upstream.headers.get("content-type");
    if (contentType) {
      res.setHeader("Content-Type", contentType);
    }

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Accept-Ranges", "bytes");

    // =========================
    // STREAM (NOT TEXT)
    // =========================
    const reader = upstream.body.getReader();

    async function pump() {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
      res.end();
    }

    pump();

  } catch (err) {
    res.status(500).send("Crash: " + err.toString());
  }
});

// =========================
// IMPORTANT RAILWAY PORT
// =========================
const port = process.env.PORT || 3000;

app.listen(port, "0.0.0.0", () => {
  console.log("Server running on port", port);
});
