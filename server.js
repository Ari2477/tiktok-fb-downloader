const express = require("express");
const axios = require("axios");
const cors = require("cors");
const cheerio = require("cheerio");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const PORT = 3000;

/* ===============================
   TikTok Downloader (No Watermark)
   ❌ DO NOT TOUCH – WORKING
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
   Facebook Downloader (REAL FIX)
   fbdown.net HTML SCRAPER
================================= */
async function facebookDownload(url) {
  try {
    const response = await axios.post(
      "https://www.fbdown.net/download.php",
      new URLSearchParams({ URLz: url }).toString(),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
          "Referer": "https://www.fbdown.net/"
        },
        timeout: 15000
      }
    );

    const $ = cheerio.load(response.data);
    const links = [];

    $("a").each((_, el) => {
      const href = $(el).attr("href");
      const text = $(el).text().toLowerCase();

      if (href && href.startsWith("https") && href.includes("video")) {
        if (text.includes("hd")) {
          links.push({ url: href, quality: "HD" });
        } else if (text.includes("sd")) {
          links.push({ url: href, quality: "SD" });
        }
      }
    });

    return { links };
  } catch (err) {
    console.error("Facebook scrape error:", err.message);
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
            "No download links found. Video must be PUBLIC."
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
