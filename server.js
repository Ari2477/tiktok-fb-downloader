const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const PORT = 3000;

/* ===============================
   TikTok Downloader (No Watermark)
================================= */
async function tiktokDownload(url) {
  try {
    const api = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`;
    const res = await axios.get(api);

    if (!res.data || !res.data.data) return null;

    return {
      title: res.data.data.title || "TikTok Video",
      video: res.data.data.play,
      music: res.data.data.music
    };
  } catch (err) {
    console.error("TikTok error:", err.message);
    return null;
  }
}

/* ===============================
   Facebook Downloader (FIXED)
   using public-apis-ph-server
================================= */
async function facebookDownload(url) {
  try {
    const apiUrl = `https://public-apis-ph-server.onrender.com/api/fbdl?url=${encodeURIComponent(
      url
    )}`;
    const res = await axios.get(apiUrl);

    const links = [];

    // Expected format
    // data.data.hd | data.data.sd
    if (res.data?.data?.hd) {
      links.push({ url: res.data.data.hd, quality: "HD" });
    }
    if (res.data?.data?.sd) {
      links.push({ url: res.data.data.sd, quality: "SD" });
    }

    return { links };
  } catch (err) {
    console.error("Facebook error:", err.message);
    return { links: [] };
  }
}

/* ===============================
   API Endpoint
================================= */
app.post("/api/download", async (req, res) => {
  try {
    const { url, platform } = req.body;
    if (!url || !platform) {
      return res.json({ success: false, error: "Missing data" });
    }

    let data;

    if (platform === "tiktok") {
      data = await tiktokDownload(url);
      if (!data) {
        return res.json({
          success: false,
          error: "TikTok download failed"
        });
      }
    }

    else if (platform === "facebook") {
      data = await facebookDownload(url);
      if (!data.links || data.links.length === 0) {
        return res.json({
          success: false,
          error:
            "No download links found. Video may be private, restricted, or unsupported."
        });
      }
    }

    else {
      return res.json({ success: false, error: "Invalid platform" });
    }

    res.json({ success: true, data });
  } catch (err) {
    console.error("API error:", err.message);
    res.json({ success: false, error: "Download failed" });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
