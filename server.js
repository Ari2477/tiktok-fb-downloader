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
  try {
    const api = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`;
    const res = await axios.get(api);

    return {
      title: res.data.data.title,
      video: res.data.data.play,
      music: res.data.data.music
    };
  } catch (err) {
    console.error("TikTok download error:", err.message);
    return null;
  }
}

// ===== Facebook Downloader (using ioark API) =====
async function facebookDownload(url) {
  try {
    const apiUrl = `https://ioark-apiv1.onrender.com/downloader/facebookv2?url=${encodeURIComponent(url)}`;
    const res = await axios.get(apiUrl);

    console.log("FB API response:", res.data); // check kung ano ang ibinabalik

    // Check if result array exists
    if (res.data && res.data.result && res.data.result.length > 0) {
      const links = res.data.result
        .filter(item => item.link) // ignore invalid entries
        .map(item => ({
          url: item.link,
          quality: item.quality || "Video"
        }));
      return { links };
    } else {
      // fallback: empty array, handled sa frontend
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

    let data = null;

    if (platform === "tiktok") {
      data = await tiktokDownload(url);
      if (!data) return res.json({ success: false, error: "TikTok download failed" });
    } else if (platform === "facebook") {
      data = await facebookDownload(url);
      if (!data.links || data.links.length === 0) {
        return res.json({
          success: false,
          data,
          error:
            "No download links found. Make sure the video is public or try another video URL."
        });
      }
    } else {
      return res.json({ success: false, error: "Invalid platform" });
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
