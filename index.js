const express = require("express");
const app = express();
const { Readable } = require("stream");

const channels = {
  HubSensasiHD:
    "https://ucdn.starhubgo.com/bpk-tv/HubSensasiHD/output/manifest.mpd"
};

// ==========================
// HELPERS
// ==========================
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function safeFetch(url, options = {}, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const res = await fetch(url, {
        ...options,
        signal: controller.signal
      });

      clearTimeout(timeout);
      return res;

    } catch (err) {
      console.log(`Fetch retry ${i + 1} failed:`, err.message);
      await sleep(800);
    }
  }
  throw new Error("Fetch failed after retries");
}

// ==========================
// MANIFEST PROXY
// ==========================
app.get("/api/proxy", async (req, res) => {
  try {
    const url = channels[req.query.channel] || req.query.url;

    if (!url) return res.status(400).send("Missing URL");

    const response = await safeFetch(url);

    if (!response.ok) {
      return res.status(response.status).send("Upstream error");
    }

    let mpd = await response.text();
    const base = url.substring(0, url.lastIndexOf("/") + 1);

    const proxyBase = `${req.protocol}://${req.get("host")}`;

    // FIXED BaseURL rewrite (NO &amp;)
    mpd = mpd.replace(
      /<BaseURL>(.*?)<\/BaseURL>/g,
      (_, p1) => {
        const fixed = p1.startsWith("http") ? p1 : new URL(p1, base).href;

        return `<BaseURL>${proxyBase}/api/segment?url=${encodeURIComponent(fixed)}&</BaseURL>`;
      }
    );

    mpd = mpd.replace(
      /(initialization|media)="([^"]+)"/g,
      (_, type, p1) => {
        const fixed = p1.startsWith("http") ? p1 : new URL(p1, base).href;

        return `${type}="${proxyBase}/api/segment?url=${encodeURIComponent(fixed)}"`;
      }
    );

    res.setHeader("Content-Type", "application/dash+xml");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.send(mpd);

  } catch (err) {
    console.log("MANIFEST ERROR:", err.message);
    res.status(500).send("Manifest proxy failed");
  }
});

// ==========================
// SEGMENT PROXY (STABLE v2)
// ==========================
app.get("/api/segment", async (req, res) => {
  const url = req.query.url;

  if (!url) return res.status(400).send("Missing url");

  try {
    const headers = {};

    if (req.headers.range) {
      headers["Range"] = req.headers.range;
    }

    const upstream = await safeFetch(url, { headers });

    if (!upstream.ok && upstream.status !== 206) {
      return res.status(upstream.status).send("Upstream error");
    }

    res.status(upstream.status);

    upstream.headers.forEach((v, k) => {
      const key = k.toLowerCase();

      if (
        key !== "content-encoding" &&
        key !== "transfer-encoding" &&
        key !== "content-length"
      ) {
        res.setHeader(k, v);
      }
    });

    res.setHeader("Access-Control-Allow-Origin", "*");

    if (!upstream.body) return res.end();

    const stream = Readable.fromWeb(upstream.body);

    stream.on("error", (err) => {
      console.log("STREAM PIPE ERROR:", err.message);
      if (!res.headersSent) {
        res.status(500).end();
      } else {
        res.end();
      }
    });

    stream.pipe(res);

  } catch (err) {
    console.log("SEGMENT ERROR:", err.message);

    if (!res.headersSent) {
      res.status(500).send("Segment failed");
    } else {
      res.end();
    }
  }
});

const port = process.env.PORT || 3000;
app.listen(port, "0.0.0.0", () => {
  console.log("Stable DASH Proxy v2 running on", port);
});
