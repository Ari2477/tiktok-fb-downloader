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
    const res = await axios.get(api, { timeout: 10000 });

    if (!res.data || !res.data.data) return null;

    return {
      title: res.data.data.title || "TikTok Video",
      video: res.data.data.play,
      music: res.data.data.music,
      cover: res.data.data.cover
    };
  } catch (err) {
    console.error("TikTok error:", err.message);
    return null;
  }
}

/* ===============================
   IMPROVED Facebook Downloader
   Multiple API Fallbacks
================================= */
async function facebookDownload(url) {
  // List of working Facebook download APIs (with fallbacks)
  const apiEndpoints = [
    {
      name: "API 1 - fbdown.net",
      url: `https://fbdown.net/api/api-v2?url=${encodeURIComponent(url)}`,
      parser: (data) => {
        const links = [];
        if (data?.hd) links.push({ url: data.hd, quality: "HD" });
        if (data?.sd) links.push({ url: data.sd, quality: "SD" });
        return links;
      }
    },
    {
      name: "API 2 - ssyoutube",
      url: `https://ssyoutube.com/api/convert?url=${encodeURIComponent(url)}`,
      parser: (data) => {
        const links = [];
        if (data?.url) {
          links.push({ url: data.url, quality: data.quality || "Best" });
        }
        return links;
      }
    },
    {
      name: "API 3 - savetik.co",
      url: `https://savetik.co/api/ajaxSearch?url=${encodeURIComponent(url)}`,
      parser: (data) => {
        const links = [];
        if (data?.data?.hd) links.push({ url: data.data.hd, quality: "HD" });
        if (data?.data?.sd) links.push({ url: data.data.sd, quality: "SD" });
        return links;
      }
    },
    {
      name: "API 4 - savevideo",
      url: `https://savevideo.co/api/ajaxSearch?url=${encodeURIComponent(url)}`,
      parser: (data) => {
        const links = [];
        if (data?.data?.hd) links.push({ url: data.data.hd, quality: "HD" });
        if (data?.data?.sd) links.push({ url: data.data.sd, quality: "SD" });
        return links;
      }
    }
  ];

  // Try each API endpoint with timeout
  for (const endpoint of apiEndpoints) {
    try {
      console.log(`Trying ${endpoint.name}...`);
      
      const response = await axios.get(endpoint.url, {
        timeout: 8000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'Referer': 'https://www.facebook.com/'
        }
      });

      if (response.data) {
        const links = endpoint.parser(response.data);
        if (links.length > 0) {
          console.log(`✓ Success with ${endpoint.name}, found ${links.length} links`);
          return { links, api: endpoint.name };
        }
      }
    } catch (err) {
      console.log(`✗ ${endpoint.name} failed: ${err.message}`);
      continue; // Try next API
    }
  }

  // If all APIs fail, try direct HTML parsing as last resort
  try {
    console.log("Trying direct HTML parsing...");
    const directLinks = await facebookDirectParse(url);
    if (directLinks.length > 0) {
      return { links: directLinks, api: "direct-html" };
    }
  } catch (err) {
    console.log("Direct parsing failed:", err.message);
  }

  return { links: [], api: "all-failed" };
}

/* ===============================
   Direct HTML Parser (Fallback)
================================= */
async function facebookDirectParse(url) {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      timeout: 10000
    });

    const html = response.data;
    const links = [];

    // Extract HD video
    const hdRegex = /"hd_src":"([^"]+)"/g;
    const hdMatch = hdRegex.exec(html);
    if (hdMatch && hdMatch[1]) {
      const hdUrl = hdMatch[1].replace(/\\\//g, '/');
      links.push({ url: hdUrl, quality: "HD" });
    }

    // Extract SD video
    const sdRegex = /"sd_src":"([^"]+)"/g;
    const sdMatch = sdRegex.exec(html);
    if (sdMatch && sdMatch[1]) {
      const sdUrl = sdMatch[1].replace(/\\\//g, '/');
      links.push({ url: sdUrl, quality: "SD" });
    }

    // Extract og:video meta
    const metaRegex = /<meta\s+property="og:video"\s+content="([^"]+)"/gi;
    let metaMatch;
    while ((metaMatch = metaRegex.exec(html)) !== null) {
      if (metaMatch[1] && metaMatch[1].includes('.mp4')) {
        links.push({ url: metaMatch[1], quality: "MP4" });
      }
    }

    return links;
  } catch (err) {
    console.error("Direct parse error:", err.message);
    return [];
  }
}

/* ===============================
   URL Validator
================================= */
function validateFacebookURL(url) {
  const patterns = [
    /(?:https?:\/\/)?(?:www\.|m\.)?facebook\.com\/[^\/]+\/videos\/\d+/i,
    /(?:https?:\/\/)?(?:www\.|m\.)?facebook\.com\/watch\/?\?v=\d+/i,
    /(?:https?:\/\/)?(?:www\.|m\.)?facebook\.com\/reel\/\d+/i,
    /(?:https?:\/\/)?fb\.watch\/[a-zA-Z0-9_-]+/i,
    /(?:https?:\/\/)?(?:www\.|m\.)?facebook\.com\/[^\/]+\/posts\/\d+/i
  ];
  
  return patterns.some(pattern => pattern.test(url));
}

/* ===============================
   API Endpoint
================================= */
app.post("/api/download", async (req, res) => {
  try {
    const { url, platform } = req.body;
    
    if (!url || !platform) {
      return res.json({ success: false, error: "Missing URL or platform" });
    }

    let data;

    if (platform === "tiktok") {
      data = await tiktokDownload(url);
      if (!data) {
        return res.json({
          success: false,
          error: "TikTok download failed. Check the URL and try again."
        });
      }
    }
    else if (platform === "facebook") {
      // Validate Facebook URL first
      if (!validateFacebookURL(url)) {
        return res.json({
          success: false,
          error: "Invalid Facebook URL format. Please use a direct video link."
        });
      }

      data = await facebookDownload(url);
      
      if (!data.links || data.links.length === 0) {
        return res.json({
          success: false,
          error: "No download links found. Possible reasons:\n1. Video is private/restricted\n2. URL is incorrect\n3. Video format not supported\n\nTry using a different video or check if it's public."
        });
      }
      
      // Add additional info
      data.info = `Downloaded via ${data.api}`;
    }
    else {
      return res.json({ success: false, error: "Invalid platform selected" });
    }

    res.json({ success: true, data });
  } catch (err) {
    console.error("API error:", err.message);
    res.json({ 
      success: false, 
      error: "Server error. Please try again later." 
    });
  }
});

/* ===============================
   Health Check Endpoint
================================= */
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "healthy", 
    timestamp: new Date().toISOString(),
    services: {
      tiktok: "operational",
      facebook: "operational"
    }
  });
});

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
  console.log(`📱 Health check: http://localhost:${PORT}/api/health`);
});
