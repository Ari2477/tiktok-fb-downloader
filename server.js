const express = require("express");
const axios = require("axios");
const cors = require("cors");
const puppeteer = require("puppeteer");

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
   Facebook Downloader (Puppeteer)
================================= */
async function facebookDownload(url) {
  try {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    // Set user agent para parang real browser
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36"
    );

    await page.goto(url, { waitUntil: "networkidle2" });

    // Attempt to get video URL
    const videoUrl = await page.evaluate(() => {
      const video = document.querySelector("video");
      return video ? video.src : null;
    });

    await browser.close();

    if (!videoUrl) {
      return { links: [] };
    }

    return { links: [{ url: videoUrl, quality: "HD" }] };
  } catch (err) {
    console.error("Facebook scraping error:", err.message);
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

    let data = null;

    if (platform === "tiktok") {
      data = await tiktokDownload(url);
      if (!data)
        return res.json({ success: false, error: "TikTok download failed" });
    } else if (platform === "facebook") {
      data = await facebookDownload(url);
      if (!data.links || data.links.length === 0) {
        return res.json({
          success: false,
          error:
            "No download links found. Video might be private or restricted."
        });
      }
    } else {
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
