const express = require("express");
const app = express();

const channels = {
  HubSensasiHD:
    "https://ucdn.starhubgo.com/bpk-tv/HubSensasiHD/output/manifest.mpd"
};

app.get("/api/proxy", async (req, res) => {
  try {
    const channel = req.query.channel;
    const url = channels[channel] || req.query.url;

    if (!url) {
      return res.status(400).send("Missing URL or channel");
    }

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0"
      }
    });

    if (!response.ok) {
      return res.status(response.status).send("Upstream error");
    }

    const data = await response.text();

    res.setHeader("Content-Type", "application/dash+xml");
    res.send(data);

  } catch (err) {
    res.status(500).send("Crash: " + err.toString());
  }
});

// IMPORTANT: Railway guna port env
const port = process.env.PORT || 3000;

app.listen(port, "0.0.0.0", () => {
  console.log("Server running on port", port);
});
