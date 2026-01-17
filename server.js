const express = require("express");
const axios = require("axios");
const path = require("path");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const PORT = 3000;

// TikTok Downloader
async function tiktokDownload(url) {
  const api = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`;
  const res = await axios.get(api);
  return {
    title: res.data.data.title,
    video: res.data.data.play,
    music: res.data.data.music
  };
}

// Facebook Downloader
async function facebookDownload(url) {
  const api = "https://fdownloader.net/api/ajaxSearch";
  const res = await axios.post(
    api,
    new URLSearchParams({ q: url, vt: "home" }),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );
  return res.data;
}

// API Endpoint
app.post("/api/download", async (req, res) => {
  try {
    const { url, platform } = req.body;
    if (!url || !platform) {
      return res.json({ success: false, error: "Missing data" });
    }

    let data;
    if (platform === "tiktok") {
      data = await tiktokDownload(url);
    } else if (platform === "facebook") {
      data = await facebookDownload(url);
    } else {
      return res.json({ success: false, error: "Invalid platform" });
    }

    res.json({ success: true, data });
  } catch (e) {
    res.json({ success: false, error: "Download failed" });
  }
});

app.listen(PORT, () => {
  console.log(`Running on http://localhost:${PORT}`);
});
