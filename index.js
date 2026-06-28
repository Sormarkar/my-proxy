const express = require("express");
const app = express();

const channels = {
  HubSensasiHD:
    "https://ucdn.starhubgo.com/bpk-tv/HubSensasiHD/output/manifest.mpd"
};

app.get("/api/proxy", async (req, res) => {
  try {
    let url = req.query.url || channels[req.query.channel];

    if (!url) {
      return res.status(400).send("Missing URL");
    }

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Referer": "https://ucdn.starhubgo.com/"
      }
    });

    if (!response.ok) {
      return res.status(response.status).send("Upstream error");
    }

    const data = await response.text();

    res.setHeader("Content-Type", "application/dash+xml");
    res.send(data);

  } catch (err) {
    res.status(500).send(err.toString());
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Server running");
});
