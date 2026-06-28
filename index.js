app.get("/api/test", async (req, res) => {
  try {
    const r = await fetch(
      "https://ucdn.starhubgo.com/bpk-tv/HubSensasiHD/output/manifest.mpd"
    );

    res.json({
      status: r.status,
      ok: r.ok
    });

  } catch (e) {
    res.json({ error: e.message });
  }
});
