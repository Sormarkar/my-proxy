app.get("/api/proxy", async (req, res) => {
  try {
    const url =
      req.query.url ||
      (req.query.channel === "HubSensasiHD"
        ? "https://ucdn.starhubgo.com/bpk-tv/HubSensasiHD/output/manifest.mpd"
        : null);

    if (!url) return res.status(400).send("Missing URL");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Referer": "https://ucdn.starhubgo.com/"
      }
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return res.status(response.status).send("Upstream error");
    }

    const data = await response.text();

    res.setHeader("Content-Type", "application/dash+xml");
    res.send(data);

  } catch (err) {
    res.status(500).send("Server error: " + err.toString());
  }
});
