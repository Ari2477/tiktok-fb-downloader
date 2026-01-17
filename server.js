const express = require("express");
const axios = require("axios");
const path = require("path");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const PORT = 3000;

// ===== TikTok Downloader (No Watermark) =====
async function tiktokDownload(url) {
  const api = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`;
  const res = await axios.get(api);
  return {
    title: res.data.data.title,
    video: res.data.data.play,
    music: res.data.data.music
  };
}

// ===== Facebook Downloader (Public Videos Only) =====
async function facebookDownload(url) {
  try {
    // Scraping fdownloader public endpoint (works for public videos)
    const res = await axios.post(
      "https://fdownloader.net/api/ajaxSearch",
      new URLSearchParams({ q: url, vt: "home" }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    // Return links array if available
    if (res.data && res.data.links && res.data.links.length > 0) {
      return { links: res.data.links };
    } else {
      return { links: [] };
    }
  } catch (err) {
    console.error("FB download error:", err.message);
    return { links: [] };
  }
}

// ===== API Endpoint =====
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

    if ((platform === "facebook") && (!data.links || data.links.length === 0)) {
      return res.json({ success: false, data, error: "No download links found (public videos only)" });
    }

    res.json({ success: true, data });
  } catch (e) {
    console.error("API error:", e.message);
    res.json({ success: false, error: "Download failed" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
