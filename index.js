const express = require("express");
const app = express();

const channels = {
  HubSensasiHD:
    "https://ucdn.starhubgo.com/bpk-tv/HubSensasiHD/output/manifest.mpd"
};

// ==========================
// MANIFEST PROXY
// ==========================
app.get("/api/proxy", async (req, res) => {
  try {
    const url = channels[req.query.channel] || req.query.url;

    if (!url) {
      return res.status(400).send("Missing URL");
    }

    const response = await fetch(url);

    if (!response.ok) {
      return res.status(response.status).send("Upstream error");
    }

    let mpd = await response.text();

    const base = url.substring(0, url.lastIndexOf("/") + 1);

    // Rewrite BaseURL
    mpd = mpd.replace(
      /<BaseURL>(.*?)<\/BaseURL>/g,
      (_, p1) =>
        `<BaseURL>${req.protocol}://${req.get("host")}/api/segment?url=${encodeURIComponent(
          new URL(p1, base).href
        )}&amp;</BaseURL>`
    );

    // Rewrite initialization
    mpd = mpd.replace(
      /initialization="([^"]+)"/g,
      (_, p1) =>
        `initialization="${req.protocol}://${req.get("host")}/api/segment?url=${encodeURIComponent(
          new URL(p1, base).href
        )}"`
    );

    // Rewrite media
    mpd = mpd.replace(
      /media="([^"]+)"/g,
      (_, p1) =>
        `media="${req.protocol}://${req.get("host")}/api/segment?url=${encodeURIComponent(
          new URL(p1, base).href
        )}"`
    );

    res.setHeader("Content-Type", "application/dash+xml");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.send(mpd);

  } catch (e) {
    res.status(500).send(e.toString());
  }
});

// ==========================
// SEGMENT PROXY
// ==========================
app.get("/api/segment", async (req, res) => {

  const url = req.query.url;

  if (!url) {
    return res.status(400).send("Missing url");
  }

  try {

    const headers = {};

    if (req.headers.range) {
      headers.Range = req.headers.range;
    }

    const upstream = await fetch(url, {
      headers
    });

    res.status(upstream.status);

    upstream.headers.forEach((v, k) => {

      if (
        k.toLowerCase() !== "content-encoding" &&
        k.toLowerCase() !== "transfer-encoding"
      ) {
        res.setHeader(k, v);
      }

    });

    res.setHeader("Access-Control-Allow-Origin", "*");

    if (upstream.body) {
      Readable.fromWeb(upstream.body).pipe(res);
    } else {
      res.end();
    }

  } catch (err) {
    res.status(500).send(err.toString());
  }

});

const { Readable } = require("stream");

const port = process.env.PORT || 3000;

app.listen(port, "0.0.0.0", () => {
  console.log("Running on", port);
});
